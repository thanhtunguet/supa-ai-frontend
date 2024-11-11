import { SendOutlined } from "@ant-design/icons";
import * as signalR from "@microsoft/signalr";
import { message as antdMessage, Button, Col, Collapse, Input, List, Row, Select, Typography } from "antd";
import axios from "axios";
import React from "react";
import ReactMarkdown from "react-markdown";
import { SupaGPT } from "./config/consts";
import { AiModel } from "./models/AiModel";
import { ChatActionType, chatReducer } from "./reducers/chat-reducer";

const { TextArea } = Input;

enum HubAction {
  RECEIVE_MESSAGE = "ReceiveMessage",
  COMPLETE_TYPING = "CompleteTyping",
  SEND_MESSAGE = "SendMessage",
}

const Chat: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = React.useState<string>("Bạn là trợ lý AI tiếng Việt có tên Susu, giúp người dùng trả lời các câu hỏi bằng tiếng Việt trong khả năng kiến thức tốt nhất mà bạn có trong mọi lĩnh vực.");
  const [input, setInput] = React.useState<string>("");
  const [username] = React.useState<string>("User"); // State to store the user's name
  const [connection, setConnection] = React.useState<signalR.HubConnection | null>();
  const [state, dispatch] = React.useReducer(chatReducer, {
    messages: [],
    isAITyping: false,
    allowUserInput: true,
  });

  const [model, setModel] = React.useState<string>("");
  const [models, setModels] = React.useState<AiModel[]>([]);

  React.useEffect(() => {
    axios.get("/api/models").then((response) => {
      setModels(response.data);
      if (response.data.length > 0) {
        const defaultModel = response.data.find((model: AiModel) => model.isDefault);
        if (defaultModel) {
          setModel(defaultModel.name);
        }
      }
    });
  }, []);

  const chatBoxRef = React.useRef<HTMLDivElement>(null); // Ref for the chat container

  React.useEffect(() => {
    const connectToHub = async () => {
      const conn = new signalR.HubConnectionBuilder()
        .withUrl("/api/chat")
        .withAutomaticReconnect()
        .build();

      conn.on(HubAction.RECEIVE_MESSAGE, (user: string, message: string) => {
        if (user === SupaGPT) {
          dispatch({
            type: ChatActionType.AI_UPDATE_MESSAGE,
            payload: message,
          });
        }
      });

      conn.on(HubAction.COMPLETE_TYPING, () => {
        dispatch({ type: ChatActionType.AI_COMPLETE });
      });

      await conn.start();
      setConnection(conn);
    };

    connectToHub();
  }, []);


  const handleSendMessage = React.useCallback(
    async () => {
      if (input.trim() === "") {
        antdMessage.warning("Please enter a message before sending.");
        return;
      }

      // Push the user command with the username
      dispatch({
        type: ChatActionType.USER_SEND,
        payload: `${username}:${input}`,
      });

      if (connection) {
        // Start AI typing and send message to backend
        dispatch({ type: ChatActionType.AI_START_TYPING, payload: "" });
        await connection.invoke(HubAction.SEND_MESSAGE, username, {
          messages: [
            ...state.messages,
            {
              user: username,
              message: input,
            },
          ],
          model: model,
          systemPrompt,
          name: username,
        });
        setInput(""); // Clear input field

        // Simulate a 2-second delay to determine if AI has completed typing
        setTimeout(() => {
          dispatch({ type: ChatActionType.AI_COMPLETE });
        }, 2000);
      }
    },
    [connection, dispatch, input, state.messages, username, model, systemPrompt],
  );

  // Scroll to the bottom when the message list changes
  React.useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [state.messages]);

  return (
    <div className="chatbot">
      <>
        <div className="messages" ref={chatBoxRef}>
          <List
            bordered
            dataSource={state.messages}
            renderItem={(msg, index) => (
              <List.Item key={index}>
                {msg.isMarkdown ? (
                  <Typography.Text>
                    <strong>{msg.user}</strong>:{" "}
                    <ReactMarkdown>{msg.message}</ReactMarkdown>
                  </Typography.Text>
                ) : (
                  <Typography.Text>
                    <strong>{msg.user}</strong>: {msg.message}
                  </Typography.Text>
                )}
              </List.Item>
            )}
          />
        </div>

        <Collapse items={[
          {
            key: "1",
            label: "Settings",
            children: [
              <Row gutter={12}>
                <Col span={6}>
                  <Input placeholder="Username" value={username} disabled={true} />
                </Col>
                <Col span={6}>
                  <Select style={{ width: "100%" }} value={model} onChange={(value) => setModel(value)}>
                    {models.map((model) => (
                      <Select.Option key={model.name} value={model.name}>
                        {model.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <Input.TextArea rows={4} placeholder="System Prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                </Col>
              </Row>
            ]
          }
        ]} />

        <TextArea
          className="input"
          value={input}
          rows={4}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={!state.allowUserInput}
          onSubmit={handleSendMessage}
          onKeyDown={(event) => {
            // Check if the key pressed is Enter
            if (event.key === 'Enter') {
              // Check if Shift key is not pressed
              if (!event.shiftKey) {
                // Prevent the default new line behavior
                event.preventDefault();
                handleSendMessage();
              }
            }
          }}
        />



        <div className="send-button-container">
          <Button
            className="send-button"
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            block
            disabled={!state.allowUserInput} // Disable button while AI is typing
          >
            Send
          </Button>
        </div>
      </>
    </div>
  );
};

export default Chat;
