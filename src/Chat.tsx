import { PlusOutlined, SendOutlined } from "@ant-design/icons";
import * as signalR from "@microsoft/signalr";
import { message as antdMessage, Button, Col, Collapse, Input, InputRef, List, Row, Select, Typography } from "antd";
import axios from "axios";
import React from "react";
import ReactMarkdown from "react-markdown";
import { SupaGPT } from "./config/consts";
import { useSystemPrompt } from "./hooks/use-system-prompt";
import { AiEndpoint } from "./models/AiEndpoint";
import { AiModel } from "./models/AiModel";
import { ChatActionType, chatReducer } from "./reducers/chat-reducer";

const { TextArea } = Input;

enum HubAction {
  RECEIVE_MESSAGE = "ReceiveMessage",
  COMPLETE_TYPING = "CompleteTyping",
  SEND_MESSAGE = "SendMessage",
}

const Chat: React.FC = () => {
  const [systemPrompt, handleSetSystemPrompt] = useSystemPrompt();

  const [username] = React.useState<string>("User");
  const [input, setInput] = React.useState<string>("");

  const [state, dispatch] = React.useReducer(chatReducer, {
    messages: [],
    isAITyping: false,
    allowUserInput: true,
  });

  const [model, setModel] = React.useState<string | undefined>();
  const [models, setModels] = React.useState<AiModel[]>([]);
  const modelInputRef = React.useRef<InputRef>(null);

  const [endpoint, setEndpoint] = React.useState<string | undefined>();
  const [endpoints, setEndpoints] = React.useState<AiEndpoint[]>([]);
  const endpointInputRef = React.useRef<InputRef>(null);



  React.useEffect(() => {
    Promise.all([
      axios.get("/api/models").then((response) => response.data),
      axios.get("/api/endpoints").then((response) => response.data),
    ])
      .then((values) => {
        const [models, endpoints] = values as unknown as [AiModel[], AiEndpoint[]];
        setModels(models);
        setEndpoints(endpoints);

        if (models.length > 0) {
          const defaultModel = models.find((m) => m.isDefault);
          if (defaultModel) {
            setModel(defaultModel.name);
          }
        }

      });
  }, []);

  const chatBoxRef = React.useRef<HTMLDivElement>(null); // Ref for the chat container

  const handleAddModel = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    const value = modelInputRef.current?.input?.value;
    if (value) {
      setModels([...models, { name: value, isDefault: false }]);
    }
  };

  const handleAddEndpoint = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    const value = modelInputRef.current?.input?.value;
    if (value) {
      setEndpoints([...endpoints, { name: value, url: value, defaultModel: model ?? 'arcee-vylinh', }]);
    }
  };

  const [connection, setConnection] = React.useState<signalR.HubConnection | null>();
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
          endpoint,
        });
        setInput(""); // Clear input field

        // Simulate a 2-second delay to determine if AI has completed typing
        setTimeout(() => {
          dispatch({ type: ChatActionType.AI_COMPLETE });
        }, 2000);
      }
    },
    [connection, dispatch, input, state.messages, username, model, systemPrompt, endpoint],
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
                    <strong>{msg.user}</strong>:
                    <ReactMarkdown>{msg.message}</ReactMarkdown>
                  </Typography.Text>
                ) : (
                  <Typography.Text>
                    <strong>{msg.user}</strong>:
                    <ReactMarkdown>{msg.message}</ReactMarkdown>
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
              <Row gutter={12} key="settings">
                <Col span={4}>
                  <Input placeholder="Username" value={username} disabled={true} />
                </Col>
                <Col span={8}>
                  <Select
                    className="w-100"
                    placeholder="Select model"
                    value={model}
                    onChange={(value) => setModel(value)}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div className="d-flex align-items-center w-100 px-2 py-2">
                          <div className="flex-grow-1">
                            <Input
                              className="flex-grow-1"
                              placeholder="Enter model name"
                              ref={modelInputRef}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex-shrink-1">
                            <Button type="text" icon={<PlusOutlined />} onClick={handleAddModel}>
                              Add model
                            </Button>
                          </div>
                        </div>
                      </>
                    )}>
                    {models.map((model, index) => (
                      <Select.Option key={index} value={model.name}>
                        {model.name}
                      </Select.Option>
                    ))}
                  </Select>

                  <Select
                    className="w-100 my-4"
                    placeholder="Select endpoint"
                    value={endpoint}
                    onChange={(value) => {
                      const endpoint = endpoints.find((e) => e.url === value);
                      setEndpoint(value);
                      if (endpoint) {
                        setModel(endpoint.defaultModel);
                      }
                    }}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div className="d-flex align-items-center w-100 px-2 py-2">
                          <div className="flex-grow-1">
                            <Input
                              className="flex-grow-1"
                              placeholder="Enter endpoint url"
                              ref={endpointInputRef}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex-shrink-1">
                            <Button type="text" icon={<PlusOutlined />} onClick={handleAddEndpoint}>
                              Add endpoint
                            </Button>
                          </div>
                        </div>
                      </>
                    )}>
                    {endpoints.map((endpoint, index) => (
                      <Select.Option key={index} value={endpoint.url}>
                        {endpoint.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <Input.TextArea
                    rows={4}
                    placeholder="System Prompt"
                    value={systemPrompt}
                    onChange={(e) => handleSetSystemPrompt(e.target.value)} />
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
