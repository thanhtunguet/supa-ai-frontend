import React from "react";

export const useSystemPrompt = (): [
    string,
    (systemPrompt: string) => void,
] => {
    const [systemPrompt, setSystemPrompt] = React.useState<string>("");

    React.useEffect(() => {
        const systemPrompt = localStorage.getItem('system-prompt');
        if (systemPrompt) {
            setSystemPrompt(systemPrompt);
        }
    }, []);

    const handleSetSystemPrompt = (systemPrompt: string) => {
        localStorage.setItem('system-prompt', systemPrompt);
        setSystemPrompt(systemPrompt);
    }

    return [
        systemPrompt,
        handleSetSystemPrompt,
    ];
}
