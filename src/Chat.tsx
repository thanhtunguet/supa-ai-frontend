import { SendOutlined } from "@ant-design/icons";
import * as signalR from "@microsoft/signalr";
import { Button, Input, List, Typography, message as antdMessage } from "antd";
import React, { useEffect, useReducer, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const { TextArea } = Input;

const SupaGPT = "Susu";

interface ChatMessage {
  user: string;
  message: string;
  isMarkdown?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isAITyping: boolean;
  allowUserInput: boolean;
}

type ChatAction =
  | { type: "USER_SEND"; payload: string }
  | { type: "AI_START_TYPING"; payload: string }
  | { type: "AI_UPDATE_MESSAGE"; payload: string }
  | { type: "AI_COMPLETE" };

const initialState: ChatState = {
  messages: [],
  isAITyping: false,
  allowUserInput: true,
};

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "USER_SEND":
      return {
        ...state,
        messages: [...state.messages, { user: "You", message: action.payload }],
        allowUserInput: false, // Disable user input until AI completes its response
      };

    case "AI_START_TYPING":
      return {
        ...state,
        messages: [...state.messages, { user: SupaGPT, message: "", isMarkdown: true }],
        isAITyping: true,
      };

    case "AI_UPDATE_MESSAGE":
      // Update the latest AI message with the new content
      return {
        ...state,
        messages: state.messages.map((msg, idx) =>
          idx === state.messages.length - 1 && msg.user === SupaGPT
            ? { ...msg, message: msg.message + action.payload }
            : msg
        ),
      };

    case "AI_COMPLETE":
      return {
        ...state,
        isAITyping: false,
        allowUserInput: true, // Re-enable user input when AI is done typing
      };

    default:
      return state;
  }
};

const Chat: React.FC = () => {
  const [input, setInput] = useState<string>("");
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const chatBoxRef = useRef<HTMLDivElement>(null); // Ref for the chat container

  useEffect(() => {
    const connectToHub = async () => {
      const conn = new signalR.HubConnectionBuilder()
        .withUrl("/api/chat")
        .withAutomaticReconnect()
        .build();

      conn.on("ReceiveMessage", (user: string, message: string) => {
        if (user === SupaGPT) {
          dispatch({ type: "AI_UPDATE_MESSAGE", payload: message });
        }
      });

      await conn.start();
      setConnection(conn);
    };

    connectToHub();
  }, []);

  const sendMessage = async () => {
    if (input.trim() === "") {
      antdMessage.warning("Please enter a message before sending.");
      return;
    }

    // Push the user command
    dispatch({ type: "USER_SEND", payload: input });

    if (connection) {
      // Start AI typing and send message to backend
      dispatch({ type: "AI_START_TYPING", payload: "" });
      await connection.invoke("SendMessage", "User", input);
      setInput(""); // Clear input field

      // Simulate a 2-second delay to determine if AI has completed typing
      setTimeout(() => {
        dispatch({ type: "AI_COMPLETE" });
      }, 2000);
    }
  };

  // Scroll to the bottom when the message list changes
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [state.messages]);

  return (
    <div className="chatbot">
      <div
      className="messages"
        ref={chatBoxRef}>
        <List
          bordered
          dataSource={state.messages}
          renderItem={(msg, index) => (
            <List.Item key={index}>
              {msg.isMarkdown ? (
                <Typography.Text>
                  <strong>{msg.user}</strong>: <ReactMarkdown>{msg.message}</ReactMarkdown>
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
        rows={4}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your message..."
        disabled={!state.allowUserInput} // Disable input while AI is typing
      />

      <div>
      <Button
        className="send-button"
        type="primary"
        icon={<SendOutlined />}
        onClick={sendMessage}
        block
        disabled={!state.allowUserInput} // Disable button while AI is typing
      >
          Send
        </Button>
      </div>
    </div>
  );
};

export default Chat;