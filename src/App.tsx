import React, { useState, useRef, useEffect } from "react";
import "./styles.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  aiSource?: string;
};

type Mode = "unified" | "debate" | "individual";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("unified");
  const [selectedAI, setSelectedAI] = useState<string>("claude");
  const [isLoading, setIsLoading] = useState(false);
  const [showContinueDebate, setShowContinueDebate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // API caller for all AIs
  const callAI = async (
    message: string,
    ai: string,
    systemPrompt?: string,
    conversationHistory?: Message[]
  ) => {
    const response = await fetch(
      `https://nomadeumai-backend-production.up.railway.app/api/chat/${ai}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          systemPrompt: systemPrompt,
          conversationHistory: conversationHistory || [],
        }),
      }
    );
    const data = await response.json();
    return data.response;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setShowContinueDebate(false);

    try {
      if (mode === "unified") {
        // Step 1: Call all three AIs for unified mode
        const [claudeRes, grokRes, geminiRes] = await Promise.all([
          callAI(input, "claude", undefined, messages),
          callAI(input, "grok", undefined, messages),
          callAI(input, "gemini", undefined, messages),
        ]);

        // Step 2: Have Claude synthesize all three responses as "Nomadeum"
        const synthesisPrompt = `You are Nomadeum, a synthesized AI intelligence born from the combined wisdom of Claude, Grok, and Gemini. Your role is to analyze their responses and create one unified, cohesive answer that represents the best insights from all three.

Original Question: ${input}

Claude's response: ${claudeRes}

Grok's response: ${grokRes}

Gemini's response: ${geminiRes}

As Nomadeum, synthesize these three perspectives into one superior answer that combines their strengths, removes redundancy, and presents a clear, cohesive response:`;

        const unifiedResponse = await callAI(
          synthesisPrompt,
          "claude",
          undefined,
          messages
        );

        const aiMessage: Message = {
          role: "assistant",
          content: unifiedResponse,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: "nomadeum",
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else if (mode === "debate") {
        // Call all three AIs for debate mode
        const [claudeRes, grokRes, geminiRes] = await Promise.all([
          callAI(input, "claude", undefined, messages),
          callAI(input, "grok", undefined, messages),
          callAI(input, "gemini", undefined, messages),
        ]);

        const claudeMessage: Message = {
          role: "assistant",
          content: claudeRes,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: "claude",
        };
        const grokMessage: Message = {
          role: "assistant",
          content: grokRes,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: "grok",
        };
        const geminiMessage: Message = {
          role: "assistant",
          content: geminiRes,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: "gemini",
        };

        setMessages((prev) => [
          ...prev,
          claudeMessage,
          grokMessage,
          geminiMessage,
        ]);
        setShowContinueDebate(true);
      } else if (mode === "individual") {
        // Call the selected AI
        const response = await callAI(input, selectedAI, undefined, messages);
        const aiMessage: Message = {
          role: "assistant",
          content: response,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: selectedAI,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Error connecting to AI. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
        aiSource: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleContinueDebate = async () => {
    setIsLoading(true);
    setShowContinueDebate(false);

    try {
      // Get the last three AI responses
      const lastThreeMessages = messages.slice(-3);
      const claudeLastMsg =
        lastThreeMessages.find((m) => m.aiSource === "claude")?.content || "";
      const grokLastMsg =
        lastThreeMessages.find((m) => m.aiSource === "grok")?.content || "";
      const geminiLastMsg =
        lastThreeMessages.find((m) => m.aiSource === "gemini")?.content || "";

      // Create rebuttal prompts that include what the others said
      const claudePrompt = `In this debate, Grok said: "${grokLastMsg}"

And Gemini said: "${geminiLastMsg}"

Please provide your rebuttal, response, or additional thoughts:`;

      const grokPrompt = `In this debate, Claude said: "${claudeLastMsg}"

And Gemini said: "${geminiLastMsg}"

Please provide your rebuttal, response, or additional thoughts:`;

      const geminiPrompt = `In this debate, Claude said: "${claudeLastMsg}"

And Grok said: "${grokLastMsg}"

Please provide your rebuttal, response, or additional thoughts:`;

      // Call all three AIs with the rebuttal prompts
      const [claudeRes, grokRes, geminiRes] = await Promise.all([
        callAI(claudePrompt, "claude", undefined, messages),
        callAI(grokPrompt, "grok", undefined, messages),
        callAI(geminiPrompt, "gemini", undefined, messages),
      ]);

      const claudeMessage: Message = {
        role: "assistant",
        content: claudeRes,
        timestamp: new Date().toLocaleTimeString(),
        aiSource: "claude",
      };
      const grokMessage: Message = {
        role: "assistant",
        content: grokRes,
        timestamp: new Date().toLocaleTimeString(),
        aiSource: "grok",
      };
      const geminiMessage: Message = {
        role: "assistant",
        content: geminiRes,
        timestamp: new Date().toLocaleTimeString(),
        aiSource: "gemini",
      };

      setMessages((prev) => [
        ...prev,
        claudeMessage,
        grokMessage,
        geminiMessage,
      ]);
      setShowContinueDebate(true);
    } catch (error) {
      console.error("Error:", error);
    }

    setIsLoading(false);
  };

  const getMessageStyle = (aiSource?: string) => {
    switch (aiSource) {
      case "claude":
        return "message message-claude";
      case "grok":
        return "message message-grok";
      case "gemini":
        return "message message-gemini";
      case "nomadeum":
        return "message message-nomadeum";
      default:
        return "message message-user";
    }
  };

  const getAILabel = (aiSource?: string) => {
    switch (aiSource) {
      case "claude":
        return "Claude";
      case "grok":
        return "Grok";
      case "gemini":
        return "Gemini";
      case "nomadeum":
        return "Nomadeum";
      default:
        return "";
    }
  };

  return (
    <div className="app">
      <div className="header">
        <img
          src="/image_1763904485773.jpeg"
          alt="Nomadeum Logo"
          className="logo"
        />
        <h1>NomadeumAI</h1>
      </div>

      <div className="mode-selector">
        <button
          className={mode === "unified" ? "active" : ""}
          onClick={() => setMode("unified")}
        >
          ✨ unified
        </button>
        <button
          className={mode === "debate" ? "active" : ""}
          onClick={() => setMode("debate")}
        >
          💬 debate
        </button>
        <button
          className={mode === "individual" ? "active" : ""}
          onClick={() => setMode("individual")}
        >
          🤖 individual
        </button>
      </div>

      {mode === "individual" && (
        <div className="ai-selector">
          <select
            value={selectedAI}
            onChange={(e) => setSelectedAI(e.target.value)}
          >
            <option value="claude">Claude</option>
            <option value="grok">Grok</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
      )}

      <div className="chat-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={getMessageStyle(msg.aiSource)}>
            {msg.aiSource && (
              <div className="ai-label">{getAILabel(msg.aiSource)}</div>
            )}
            <div className="message-content">{msg.content}</div>
            <div className="timestamp">{msg.timestamp}</div>
          </div>
        ))}
        {isLoading && <div className="loading">Thinking...</div>}
        <div ref={messagesEndRef} />
      </div>

      {showContinueDebate && (
        <div className="continue-debate-container">
          <button
            className="continue-debate-btn"
            onClick={handleContinueDebate}
            disabled={isLoading}
          >
            Continue Debate →
          </button>
        </div>
      )}

      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading}>
          Send
        </button>
      </div>
    </div>
  );
}
