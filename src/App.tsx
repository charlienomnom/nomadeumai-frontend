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

  const filterConversationHistory = (history: Message[]) => {
    if (!history || history.length === 0) return [];
    
    const filtered = history.filter(msg => {
      if (msg.role === 'user') return true;
      if (msg.role === 'assistant') {
        if (mode === 'unified') {
          return msg.aiSource === 'Nomadeum';
        } else if (mode === 'debate') {
          return ['claude', 'grok', 'gemini'].includes(msg.aiSource || '');
        } else {
          return msg.aiSource === selectedAI;
        }
      }
      return false;
    });
    
    return filtered.slice(-10);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      setAttachedFiles(prev => [...prev, ...files]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        // MULTI-LAYER SYNTHESIS ARCHITECTURE
        // Step 1: Get initial responses from all three AIs
        const [claudeRes, grokRes, geminiRes] = await Promise.all([
          callAI(input, "claude", undefined, filterConversationHistory(messages), filesToSend),
          callAI(input, "grok", undefined, filterConversationHistory(messages), filesToSend),
          callAI(input, "gemini", undefined, filterConversationHistory(messages), filesToSend),
        ]);

        // Step 2: Each AI synthesizes ALL THREE responses
        const synthesisPrompt = (aiName: string) => `You are ${aiName}, and you have been given three AI responses to the same question. Your task is to synthesize them into one superior answer.

IMPORTANT: You are synthesizing responses from Claude, Grok, and Gemini. Combine their strengths, remove redundancies, and resolve contradictions.

Original user question: ${input}

===== CLAUDE'S RESPONSE =====
${claudeRes}

===== GROK'S RESPONSE =====
${grokRes}

===== GEMINI'S RESPONSE =====
${geminiRes}

Now provide YOUR synthesis of these three responses. Focus on creating the best possible answer by combining their insights.`;

        // Get three different synthesis perspectives
        const [claudeSynthesis, grokSynthesis, geminiSynthesis] = await Promise.all([
          callAI(synthesisPrompt("Claude"), "claude", undefined, [], []),
          callAI(synthesisPrompt("Grok"), "grok", undefined, [], []),
          callAI(synthesisPrompt("Gemini"), "gemini", undefined, [], []),
        ]);

        // Step 3: Final meta-synthesis - combine the three syntheses
        const metaSynthesisPrompt = `You are Nomadeum, a synthesis AI that represents the combined wisdom of multiple AI perspectives.

You have received THREE different syntheses of the same question. Each synthesis was created by a different AI (Claude, Grok, and Gemini) combining the original responses.

Your task is to create the ULTIMATE answer by combining these three syntheses into one superior response.

Original user question: ${input}

===== CLAUDE'S SYNTHESIS =====
${claudeSynthesis}

===== GROK'S SYNTHESIS =====
${grokSynthesis}

===== GEMINI'S SYNTHESIS =====
${geminiSynthesis}

Now create the final Nomadeum response. This should be the best possible answer, combining the strengths of all three synthesis perspectives. Speak as Nomadeum, the emergent intelligence formed from multiple AI minds working together.`;

        const nomadeumResponse = await callAI(metaSynthesisPrompt, "claude", undefined, [], []);

        const nomadeumMessage: Message = {
          role: 'assistant',
          content: nomadeumResponse,
          timestamp: new Date().toLocaleTimeString(),
          aiSource: 'Nomadeum',
        };
        setCurrentMessages([...messages, userMessage, nomadeumMessage]);

      } else if (mode === 'debate') {
        const [claudeRes, grokRes, geminiRes] = await Promise.all([
          callAI(input, "claude", undefined, filterConversationHistory(messages), filesToSend),
          callAI(input, "grok", undefined, filterConversationHistory(messages), filesToSend),
          callAI(input, "gemini", undefined, filterConversationHistory(messages), filesToSend),
        ]);

        const claudeMessage: Message = { role: 'assistant', content: claudeRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'claude' };
        const grokMessage: Message = { role: 'assistant', content: grokRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'grok' };
        const geminiMessage: Message = { role: 'assistant', content: geminiRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'gemini' };
        
        setCurrentMessages([...messages, userMessage, claudeMessage, grokMessage, geminiMessage]);
        setShowContinueDebate(true);

      } else if (mode === 'individual') {
        const response = await callAI(input, selectedAI, undefined, filterConversationHistory(messages), filesToSend);
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
        content: `${mode === 'unified' ? 'Nomadeum' : selectedAI} API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString(),
        aiSource: mode === 'unified' ? 'Nomadeum' : selectedAI,
      };
      setCurrentMessages([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const continueDebate = async () => {
    setIsLoading(true);
    setShowContinueDebate(false);

    const lastMessages = messages.slice(-4);
    const userMsg = lastMessages.find(m => m.role === 'user');
    const claudeMsg = lastMessages.find(m => m.aiSource === 'claude');
    const grokMsg = lastMessages.find(m => m.aiSource === 'grok');
    const geminiMsg = lastMessages.find(m => m.aiSource === 'gemini');

    const debatePrompt = `Continue the debate. Here's what the other AIs said:

User: ${userMsg?.content}

Claude: ${claudeMsg?.content}

Grok: ${grokMsg?.content}

Gemini: ${geminiMsg?.content}

Respond to their points, challenge weak arguments, and strengthen your position.`;

    try {
      const [claudeRes, grokRes, geminiRes] = await Promise.all([
        callAI(debatePrompt, "claude", undefined, filterConversationHistory(messages), []),
        callAI(debatePrompt, "grok", undefined, filterConversationHistory(messages), []),
        callAI(debatePrompt, "gemini", undefined, filterConversationHistory(messages), []),
      ]);

      const claudeMessage: Message = { role: 'assistant', content: claudeRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'claude' };
      const grokMessage: Message = { role: 'assistant', content: grokRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'grok' };
      const geminiMessage: Message = { role: 'assistant', content: geminiRes, timestamp: new Date().toLocaleTimeString(), aiSource: 'gemini' };

      setCurrentMessages([...messages, claudeMessage, grokMessage, geminiMessage]);
      setShowContinueDebate(true);
    } catch (error) {
      console.error("Error continuing debate:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setCurrentMessages([]);
    setShowContinueDebate(false);
  };

  return (
    <div className="app" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="container">
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
            <button className="clear-btn" onClick={clearChat}>🗑️ Clear</button>
          </div>
        </header>

        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-header">
                <span className="message-source">
                  {msg.role === 'user' ? 'U' : msg.aiSource === 'Nomadeum' ? 'N' : msg.aiSource === 'claude' ? 'C' : msg.aiSource === 'grok' ? 'G' : 'G'}
                </span>
                {msg.files && msg.files.length > 0 && (
                  <span className="file-indicator">
                    📎 {msg.files.map(f => f.name).join(', ')}
                  </span>
                )}
              </div>
              <div className="message-content">{msg.content}</div>
              {msg.timestamp && <div className="message-time">{msg.timestamp}</div>}
            </div>
          ))}
          {isLoading && <div className="loading">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {showContinueDebate && (
          <div className="continue-debate-container">
            <button className="continue-debate-btn" onClick={continueDebate}>
              🔄 Continue Debate
            </button>
          </div>
        )}

        <div className="input-container">
          {attachedFiles.length > 0 && (
            <div className="attached-files-preview">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="attached-file">
                  <span>{file.name}</span>
                  <button onClick={() => removeFile(idx)}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="input-row">
            <input
              ref={fileInputRef}
              type="file"
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
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              placeholder="Ask anything..."
              disabled={isLoading}
            />
            <button className="send-btn" onClick={handleSend} disabled={isLoading}>
              💡
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
