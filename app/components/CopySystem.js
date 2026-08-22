"use client";
import React from "react";
import { X, Minimize2, Maximize2, FileUp, Upload } from "lucide-react";

// ----------------------------------------------------
// 1. CopyHeader
// ----------------------------------------------------
export function CopyHeader({ title, isCopyRunning, onMinimize, onClose }) {
    return (
        <div className="copy-modal-header">
            <h2>{title}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {isCopyRunning && onMinimize && (
                    <button
                        type="button"
                        className="copy-modal-header-icon-btn"
                        onClick={onMinimize}
                        title="Minimize to Background"
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#64748b",
                            cursor: "pointer",
                            padding: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "6px",
                            transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                        <Minimize2 size={18} />
                    </button>
                )}
                <button
                    type="button"
                    className="copy-modal-close-btn"
                    onClick={onClose}
                    disabled={isCopyRunning}
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// 2. StatusBadge
// ----------------------------------------------------
export function StatusBadge({ status }) {
    const cardClass = status || "pending";
    return (
        <span className={`copy-progress-badge ${cardClass}`}>
            {status.toUpperCase()}
        </span>
    );
}

// ----------------------------------------------------
// 3. CopyProgressBar
// ----------------------------------------------------
export function CopyProgressBar({ percent, status }) {
    const statClass = status || "running";
    return (
        <div className="copy-global-progress-bar-container" style={{ margin: "4px 0" }}>
            <div 
                className={`copy-global-progress-bar-fill ${statClass}`} 
                style={{ 
                    width: `${percent}%`,
                    background: statClass === "completed" ? "#10b981" : statClass === "failed" ? "#ef4444" : statClass === "cancelled" ? "#f59e0b" : "linear-gradient(90deg, #38bdf8, #6366f1)"
                }}
            ></div>
            <span className="copy-global-progress-percent">{percent}%</span>
        </div>
    );
}

// ----------------------------------------------------
// 4. ProgressStats
// ----------------------------------------------------
export function ProgressStats({ stats, formatTime }) {
    const elapsed = stats?.elapsed || 0;
    const eta = stats?.eta || 0;
    return (
        <div className="copy-global-time-row">
            <span>Elapsed Time: <strong>{formatTime(elapsed)}</strong></span>
            <span>Estimated Completion: <strong>{formatTime(eta)}</strong></span>
        </div>
    );
}

// ----------------------------------------------------
// 5. CopyProgressCard
// ----------------------------------------------------
export function CopyProgressCard({ name, stats, percent, isStuck, formatTime, status }) {
    return (
        <div className="copy-global-progress-card">
            <h4 className="copy-global-progress-title">{name} Progress</h4>
            
            <div className="copy-global-stats-row">
                <div className="copy-global-stat-box">
                    <span className="copy-global-stat-label">Websites</span>
                    <span className="copy-global-stat-value">{stats?.completedWebsites} / {stats?.totalWebsites}</span>
                </div>
                <div className="copy-global-stat-box">
                    <span className="copy-global-stat-label">Products</span>
                    <span className="copy-global-stat-value">{stats?.copiedProducts} / {stats?.totalProducts}</span>
                </div>
                <div className="copy-global-stat-box">
                    <span className="copy-global-stat-label">Speed</span>
                    <span className="copy-global-stat-value">{stats?.speed} items/sec</span>
                </div>
            </div>

            {isStuck && (
                <div className="stuck-warning-banner">
                    ⚠ Waiting for database response... Retrying write...
                </div>
            )}

            <CopyProgressBar percent={percent} status={status} />
            <ProgressStats stats={stats} formatTime={formatTime} />
        </div>
    );
}

// ----------------------------------------------------
// 6. CopyLogs
// ----------------------------------------------------
export function CopyLogs({ logs, logsEndRef }) {
    return (
        <div className="copy-logs-panel">
            <h4 className="copy-logs-title">Live Log Stream</h4>
            <div className="copy-logs-container" style={{ maxHeight: "180px", overflowY: "auto" }}>
                {logs && logs.map((log, index) => {
                    let logClass = "log-info";
                    if (log.includes("✔")) logClass = "log-success";
                    if (log.includes("❌")) logClass = "log-error";
                    if (log.includes("⚠")) logClass = "log-warning";
                    return (
                        <div key={index} className={`copy-log-line ${logClass}`}>
                            {log}
                        </div>
                    );
                })}
                <div ref={logsEndRef}></div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// 7. CopySummary
// ----------------------------------------------------
export function CopySummary({ summary, onClose, formatTime }) {
    if (!summary) return null;
    const isCancelled = summary.status === "cancelled";

    return (
        <div className="copy-overlay" style={{ zIndex: 9999 }}>
            {isCancelled ? (
                <>
                    <div style={{ marginBottom: "16px", display: "inline-flex", padding: "12px", background: "#fef3c7", borderRadius: "50%" }}>
                        <span style={{ fontSize: "28px", color: "#d97706", fontWeight: "700" }}>⚠</span>
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#111827", fontSize: "20px", fontWeight: "700" }}>Operation Cancelled</h3>
                    <p style={{ margin: "0 0 20px 0", color: "#4b5563", fontSize: "14px" }}>The operation was terminated by the user.</p>

                    <div className="copy-summary-card">
                        <div className="copy-summary-grid">
                            <span className="copy-summary-label">Copied Products:</span>
                            <span className="copy-summary-value" style={{ color: "#16a34a" }}>{summary.copied}</span>

                            <span className="copy-summary-label">Remaining Products:</span>
                            <span className="copy-summary-value" style={{ color: "#dc2626" }}>{summary.remaining}</span>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div style={{ marginBottom: "16px", display: "inline-flex", padding: "12px", background: "#dcfce7", borderRadius: "50%" }}>
                        <span style={{ fontSize: "28px", color: "#16a34a", fontWeight: "700" }}>✓</span>
                    </div>
                    <h3 style={{ margin: "0 0 8px 0", color: "#111827", fontSize: "20px", fontWeight: "700" }}>Operation Completed</h3>
                    <p style={{ margin: "0 0 20px 0", color: "#4b5563", fontSize: "14px" }}>Here is the summary of the background task:</p>

                    <div className="copy-summary-card">
                        <div className="copy-summary-grid">
                            <span className="copy-summary-label">Websites Updated:</span>
                            <span className="copy-summary-value">{summary.websites}</span>

                            <span className="copy-summary-label">Total Products Copied:</span>
                            <span className="copy-summary-value">{summary.products}</span>

                            <span className="copy-summary-label">Elapsed Time:</span>
                            <span className="copy-summary-value">{formatTime(summary.elapsed)}</span>

                            <span className="copy-summary-label">Average Speed:</span>
                            <span className="copy-summary-value">{summary.speed} items/sec</span>
                        </div>
                    </div>
                </>
            )}

            <button
                type="button"
                className="copy-btn-primary"
                onClick={onClose}
                style={{ marginTop: "12px" }}
            >
                Close View
            </button>
        </div>
    );
}

// ----------------------------------------------------
// 8. CopyFooter
// ----------------------------------------------------
export function CopyFooter({ isCopyRunning, onCancel, onClose, onStart, startDisabled }) {
    return (
        <div className="copy-modal-footer">
            {isCopyRunning ? (
                <button
                    type="button"
                    className="copy-btn-secondary"
                    onClick={onCancel}
                    style={{ background: "#ef4444", color: "white", borderColor: "#dc2626" }}
                >
                    Cancel Operation
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        className="copy-btn-secondary"
                        onClick={onClose}
                    >
                        Close Dialog
                    </button>
                    {onStart && (
                        <button
                            type="button"
                            className="copy-btn-primary"
                            onClick={onStart}
                            disabled={startDisabled}
                        >
                            Start Processing
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
