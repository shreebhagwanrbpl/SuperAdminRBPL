"use client";

import { useState } from "react";

export default function AIPage() {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);

    const askAI = async () => {
        if (!question.trim()) return;

        setLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    question,
                }),
            });

            const data = await res.json();

            setAnswer(data.answer || data.error);
        } catch (error) {
            console.log(error);
            setAnswer("Something went wrong");
        }

        setLoading(false);
    };

    return (
        <div style={{ padding: "30px" }}>
            <h1>🤖 AI Assistant</h1>

            <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask AI..."
                style={{
                    width: "100%",
                    height: "120px",
                    padding: "10px",
                    marginTop: "20px",
                }}
            />

            <button
                onClick={askAI}
                style={{
                    marginTop: "15px",
                    padding: "10px 20px",
                    cursor: "pointer",
                }}
            >
                {loading ? "Thinking..." : "Ask AI"}
            </button>

            {answer && (
                <div
                    style={{
                        marginTop: "20px",
                        padding: "20px",
                        border: "1px solid #ddd",
                        borderRadius: "10px",
                    }}
                >
                    <h3>Answer</h3>
                    <p>{answer}</p>
                </div>
            )}
        </div>
    );
}