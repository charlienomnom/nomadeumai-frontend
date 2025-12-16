import axios from 'axios';
import React, { useState, useRef, useEffect } from "react";
import './App.css';
import backgroundImage from './PYdGksRAWXgNGpAS.png';
import nomadeumLogo from './eSandefSiHlicvjZ.png';

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  aiSource?: string;
  files?: AttachedFile[];
};

type AttachedFile = {
  name: string;
  size: number;
  type: string;
  preview?: string;
};

type Mode = "unified" | "debate" | "individual";

export default function App() {
  // Separate message history for each mode
  const [unifiedMessages, setUnifiedMessages] = useState<Message[]>([]);
  const [debateMessages, setDebateMessages] = useState<Message[]>([]);
  const [individualMessages, setIndividualMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("unified");
  const [selectedAI, setSelectedAI] = useState<string>("claude");
  const [isLoading, setIsLoading] = useState(false);
  const [showContinueDebate, setShowContinueDebate] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the current messages based on mode
  const getCurrentMessages = () => {
    switch (mode) {
      case "unified": return unifiedMessages;
      case "debate": return debateMessages;
      case "individual": return individualMessages;
      default: return [];
    }
  };

  // Set messages for the current mode
  const setCurrentMessages = (messages: Message[]) => {
    switch (mode) {
      case "unified": setUnifiedMessages(messages); break;
      case "debate": setDebateMessages(messages); break;
      case "individual": setIndividualMessages(messages); break;
    }
  };

  const messages = getCurrentMessages();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const callAI = async (
    message: string,
    ai: string,
    systemPrompt?: string,
    conversationHistory?: Message[],
    files?: File[]
  ) => {
    const formData = new FormData();
    formData.append('message', message);
    if (systemPrompt) formData.append('systemPrompt', systemPrompt);
    if (conversationHistory) formData.append('conversationHistory', JSON.stringify(conversationHistory));
    
    // Attach files
    if (files && files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }

    const response = await axios.post(
      `https://nomadeumai-backend-production.up.railway.app/api/chat/${ai}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.response;
  };

  const handleClearChat = () => {
    setCurrentMessages([]);
    setShowContinueDebate(false);
    setAttachedFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    setIsLoading(true);
    setShowContinueDebate(false);

    const fileInfo: AttachedFile[] = attachedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    const userMessage: Message = {
      role: 'user',
      content: input || '[Files attached]',
      timestamp: new Date().toLocaleTimeString(),
      files: fileInfo.length > 0 ? fileInfo : undefined,
    };

    setCurrentMessages([...messages, userMessage]);
    setInput('');
    const filesToSend = [...attachedFiles];
    setAttachedFiles([]);

    try {
      if (mode === 'unified') {
        const [claudeRes, grokRes, geminiRes] = await Promise.all([
          callAI(input, "claude", undefined, messages, filesToSend),
          callAI(input, "grok", undefined, messages, filesToSend),
          callAI(input, "gemini", undefined, messages, filesToSend),
        ]);

        const synthesisPrompt = `You are Nomadeum, a synthesized AI Intelligence born from the combined wisdom of Claude, Grok, and Gemini. Your task is to analyze the following perspectives on a user's query and synthesize them into one superior answer that combines their strengths, removes redundancies, and presents a unified, expert conclusion.

        Original Question: ${input}

        Claude's response: ${claudeRes}

        Grok's response: ${grokRes}

        Gemini's response: ${geminiRes}

        As Nomadeum, synthesize these three perspectives into one superior answer that combines their strengths, removes redundancies, and presents a unified, expert conclusion.`;

        const unifiedResponse = await callAI(synthesisPrompt, "claude", undefined, messages);

        const nomadeumMessage: Message = {
          role: 'assistant',
          content: unifiedResponse,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: 'Nomadeum',
        };
        setCurrentMessages([...messages, userMessage, nomadeumMessage]);

      } else if (mode === 'debate') {
        const [claudeRes, grokRes, geminiRes] = await Promise.all([
          callAI(input, "claude", undefined, messages, filesToSend),
          callAI(input, "grok", undefined, messages, filesToSend),
          callAI(input, "gemini", undefined, messages, filesToSend),
        ]);

        const claudeMessage: Message = { role: 'assistant', content: claudeRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'claude' };
        const grokMessage: Message = { role: 'assistant', content: grokRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'grok' };
        const geminiMessage: Message = { role: 'assistant', content: geminiRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'gemini' };
        
        setCurrentMessages([...messages, userMessage, claudeMessage, grokMessage, geminiMessage]);
        setShowContinueDebate(true);

      } else if (mode === 'individual') {
        const response = await callAI(input, selectedAI, undefined, messages, filesToSend);
        const aiMessage: Message = {
          role: 'assistant',
          content: response,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: selectedAI,
        };
        setCurrentMessages([...messages, userMessage, aiMessage]);
      }

    } catch (error) {
      console.error("An error occurred during the AI call:", error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please check the console for details.',
        timestamp: new Date().toLocaleTimeString(),
        aiSource: 'System',
      };
      setCurrentMessages([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueDebate = async () => {
    setIsLoading(true);
    setShowContinueDebate(false);

    try {
      const lastThreeMessages = messages.slice(-3);
      const claudeLastMsg = lastThreeMessages.find((m) => m.aiSource === "claude")?.content || "";
      const grokLastMsg = lastThreeMessages.find((m) => m.aiSource === "grok")?.content || "";
      const geminiLastMsg = lastThreeMessages.find((m) => m.aiSource === "gemini")?.content || "";

      const claudePrompt = `In this debate, Grok said: "${grokLastMsg}"\n\nAnd Gemini said: "${geminiLastMsg}"\n\nDirectly rebut or build upon their points. Provide your concise response.`;
      const grokPrompt = `In this debate, Claude said: "${claudeLastMsg}"\n\nAnd Gemini said: "${geminiLastMsg}"\n\nDirectly rebut or build upon their points. Provide your concise response.`;
      const geminiPrompt = `In this debate, Claude said: "${claudeLastMsg}"\n\nAnd Grok said: "${grokLastMsg}"\n\nDirectly rebut or build upon their points. Provide your concise response.`;

      const [claudeRes, grokRes, geminiRes] = await Promise.all([
        callAI(claudePrompt, "claude", undefined, []),
        callAI(grokPrompt, "grok", undefined, []),
        callAI(geminiPrompt, "gemini", undefined, []),
      ]);

      const claudeMessage: Message = { role: "assistant", content: claudeRes, timestamp: new Date().toLocaleTimeString(), aiSource: "claude" };
      const grokMessage: Message = { role: "assistant", content: grokRes, timestamp: new Date().toLocaleTimeString(), aiSource: "grok" };
      const geminiMessage: Message = { role: "assistant", content: geminiRes, timestamp: new Date().toLocaleTimeString(), aiSource: "gemini" };

      setCurrentMessages([...messages, claudeMessage, grokMessage, geminiMessage]);
      setShowContinueDebate(true);
    } catch (error) {
      console.error("Error during debate continuation:", error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, an error occurred during the debate. Please try again.',
        timestamp: new Date().toLocaleTimeString(),
        aiSource: 'System',
      };
      setCurrentMessages([...messages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAIAvatarInitial = (aiSource?: string) => {
    switch (aiSource) {
      case "claude": return "C";
      case "grok": return "G";
      case "gemini": return "G";
      case "Nomadeum": return "N";
      case "user": return "U";
      default: return "";
    }
  };

  return (
    <div className="app" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="main-container">
        <header className="header">
          <div className="header-content">
            <div className="logo-container">
              <img src={nomadeumLogo} alt="Nomadeum Logo" className="nomadeum-logo" />
            </div>
            <div className="mode-selector">
              <button className={mode === "unified" ? "active" : ""} onClick={() => setMode("unified")}>✨ unified</button>
              <button className={mode === "debate" ? "active" : ""} onClick={() => setMode("debate")}>💬 debate</button>
              <button className={mode === "individual" ? "active" : ""} onClick={() => setMode("individual")}>🤖 individual</button>
            </div>
            {mode === "individual" && (
              <div className="ai-selector">
                <select value={selectedAI} onChange={(e) => setSelectedAI(e.target.value)}>
                  <option value="claude">Claude</option>
                  <option value="grok">Grok</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
            )}
            <button className="clear-chat-btn" onClick={handleClearChat} title="Clear chat history">
              🗑️ Clear
            </button>
          </div>
        </header>

        <main className="messages-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">
                <div className={`avatar ${msg.role} ${msg.aiSource || ''}`}>
                  <span>{getAIAvatarInitial(msg.aiSource || msg.role)}</span>
                </div>
                <div className="message-bubble-container">
                  <div className={`message-bubble ${msg.role}`}>
                    {msg.files && msg.files.length > 0 && (
                      <div className="message-files">
                        {msg.files.map((file, fileIdx) => (
                          <div key={fileIdx} className="message-file-tag">
                            📎 {file.name} ({formatFileSize(file.size)})
                          </div>
                        ))}
                      </div>
                    )}
                    <p>{msg.content}</p>
                  </div>
                  <div className="timestamp">{msg.timestamp}</div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message assistant">
              <div className="message-content">
                <div className="message-bubble-container">
                  <div className="loading">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

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

        <footer className="input-area">
          {attachedFiles.length > 0 && (
            <div className="attached-files-preview">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="file-preview-item">
                  <span className="file-preview-icon">📎</span>
                  <span className="file-preview-name">{file.name}</span>
                  <span className="file-preview-size">({formatFileSize(file.size)})</span>
                  <button className="file-preview-remove" onClick={() => handleRemoveFile(idx)}>×</button>
                </div>
              ))}
            </div>
          )}
          
          <div 
            className={`input-container ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
            />
            <button 
              className="attach-btn" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Attach files"
            >
              📎
            </button>
            <input
              type="text"
              className="input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              placeholder={isDragging ? "Drop files here..." : "Ask anything..."}
              disabled={isLoading}
            />
            <button className="send-btn" onClick={handleSend} disabled={isLoading}>
              <span>Send</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
