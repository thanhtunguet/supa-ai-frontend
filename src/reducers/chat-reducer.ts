import { SupaGPT } from "../config/consts";
import { ChatMessage } from "../models/ChatMessage";

export interface ChatState {
    messages: ChatMessage[];

    isAITyping: boolean;

    allowUserInput: boolean;
}

export enum ChatActionType {
    USER_SEND = "USER_SEND",
    AI_START_TYPING = "AI_START_TYPING",
    AI_UPDATE_MESSAGE = "AI_UPDATE_MESSAGE",
    AI_COMPLETE = "AI_COMPLETE",
}

export type ChatAction =
    | { type: ChatActionType.USER_SEND; payload: string }
    | { type: ChatActionType.AI_START_TYPING; payload: string }
    | { type: ChatActionType.AI_UPDATE_MESSAGE; payload: string }
    | { type: ChatActionType.AI_COMPLETE };



export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
    switch (action.type) {
        case ChatActionType.USER_SEND:
            return {
                ...state,
                messages: [
                    ...state.messages,
                    {
                        user: action.payload.split(":")[0],
                        message: action.payload.split(":")[1],
                    },
                ],
                allowUserInput: false, // Disable user input until AI completes its response
            };

        case ChatActionType.AI_START_TYPING:
            return {
                ...state,
                messages: [
                    ...state.messages,
                    { user: SupaGPT, message: "", isMarkdown: true },
                ],
                isAITyping: true,
            };

        case ChatActionType.AI_UPDATE_MESSAGE:
            // Update the latest AI message with the new content
            return {
                ...state,
                messages: state.messages.map((msg, idx) =>
                    idx === state.messages.length - 1 && msg.user === SupaGPT
                        ? { ...msg, message: msg.message + action.payload }
                        : msg
                ),
            };

        case ChatActionType.AI_COMPLETE:
            return {
                ...state,
                isAITyping: false,
                allowUserInput: true, // Re-enable user input when AI is done typing
            };

        default:
            return state;
    }
};
