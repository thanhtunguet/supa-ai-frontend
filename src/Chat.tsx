import { SendOutlined } from "@ant-design/icons";
import * as signalR from "@microsoft/signalr";
import { message as antdMessage, Button, Input, List, Typography } from "antd";
import React from "react";
import ReactMarkdown from "react-markdown";
import { SupaGPT } from "./config/consts";
import { ChatActionType, chatReducer } from "./reducers/chat-reducer";

const { TextArea } = Input;

enum HubAction {
  RECEIVE_MESSAGE = "ReceiveMessage",
  COMPLETE_TYPING = "CompleteTyping",
}

const Chat: React.FC = () => {
  const [input, setInput] = React.useState<string>("");
  const [username, setUsername] = React.useState<string>(""); // State to store the user's name
  const [isUsernameSet, setIsUsernameSet] = React.useState<boolean>(false); // To track if the username is set
  const [connection, setConnection] = React.useState<signalR.HubConnection | null>();
  const [state, dispatch] = React.useReducer(chatReducer, {
    messages: [],
    isAITyping: false,
    allowUserInput: true,
  });

  const chatBoxRef = React. useRef<HTMLDivElement>(null); // Ref for the chat container

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

  const handleUsernameSubmit = React.useCallback(
    () => {
      if (username.trim() === "") {
        antdMessage.warning("Please enter a username.");
        return;
      }
      setIsUsernameSet(true); // Mark username as set
    },
    [username],
  );

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
        await connection.invoke("SendMessage", username, [
          ...state.messages,
          {
            user: username,
            message: input,
          },
        ]);
        setInput(""); // Clear input field
  
        // Simulate a 2-second delay to determine if AI has completed typing
        setTimeout(() => {
          dispatch({ type: ChatActionType.AI_COMPLETE });
        }, 2000);
      }
    },
    [connection, dispatch, input, state.messages, username],
  );

  // Scroll to the bottom when the message list changes
  React.useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [state.messages]);

  return (
    <div className="chatbot">
      {!isUsernameSet ? (
        <div className="username-container">
          <Input
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onPressEnter={handleUsernameSubmit}
            className="username-input"
          />
          <Button type="primary" onClick={handleUsernameSubmit}>
            Start Chatting
          </Button>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default Chat;
