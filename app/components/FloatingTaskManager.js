"use client";
import React, { useState, useEffect, useRef } from "react";
import { useTaskManager } from "../src/context/TaskManagerContext";
import { 
    Maximize2, 
    Minimize2, 
    X, 
    Play, 
    Pause, 
    Terminal, 
    Activity, 
    Clock, 
    Globe 
} from "lucide-react";
import PortalModal from "./PortalModal";

// =========================================================
// DEPLOYMENT DASHBOARD SUB-COMPONENT
// =========================================================
function ExpandedTaskDashboard({ t, removeTask, updateTask, formatTime }) {
    const [isPaused, setIsPaused] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const consoleStreamRef = useRef(null);

    // Auto scroll to logs bottom when new logs arrive (without scrollIntoView)
    useEffect(() => {
        const consoleEl = consoleStreamRef.current;
        if (consoleEl && autoScroll) {
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    }, [t.logs, autoScroll]);

    // Handle scroll to temporarily pause auto-scroll if scrolling up
    const handleConsoleScroll = (e) => {
        const el = e.currentTarget;
        // Check if user is scrolled near the bottom (tolerance of 20px)
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 20;
        if (isNearBottom) {
            setAutoScroll(true);
        } else {
            setAutoScroll(false);
        }
    };

    // Handle Pause/Resume mock toggle
    const handlePauseToggle = () => {
        const nextState = !isPaused;
        setIsPaused(nextState);
        const logMsg = nextState 
            ? `[Process paused (user interface action)]`
            : `[Process resumed (user interface action)]`;
        
        const timestamp = new Date().toLocaleTimeString();
        const formattedLog = `[${timestamp}] ⚠ ${logMsg}`;
        updateTask(t.id, {
            logs: [...(t.logs || []), formattedLog]
        });
    };

    // Metrics computation
    const stats = t.stats || {};
    const totalWebsites = stats.totalWebsites || 0;
    const completedWebsites = stats.completedWebsites || 0;
    const totalProducts = stats.totalProducts || 0;
    const copiedProducts = stats.copiedProducts || 0;
    const skippedProducts = stats.productsSkipped || 0;
    const remainingProducts = Math.max(0, totalProducts - (copiedProducts + skippedProducts));
    const speed = stats.speed || 0;
    const elapsed = stats.elapsed || 0;
    const eta = stats.eta || 0;

    const getStatusColor = (status) => {
        switch (status) {
            case "completed": return "#10b981";
            case "failed": return "#ef4444";
            case "cancelled": return "#f59e0b";
            default: return "#3b82f6";
        }
    };

    const isRunning = t.status === "running";

    return (
        <div className="dashboard-layout-container" style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "calc(90vh - 48px)" }}>
            {/* 1. Header (Sticky/Fixed at Top) */}
            <div className="copy-modal-header" style={{ flex: "none", marginBottom: "12px", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h2>{t.name}</h2>
                    <span 
                        style={{ 
                            fontSize: "11px", 
                            fontWeight: "800", 
                            textTransform: "uppercase", 
                            background: `${getStatusColor(t.status)}15`, 
                            color: getStatusColor(t.status),
                            padding: "3px 10px",
                            borderRadius: "12px",
                            border: `1px solid ${getStatusColor(t.status)}25`
                        }}
                    >
                        {t.status}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {isRunning && (
                        <button
                            type="button"
                            className="copy-modal-close-btn"
                            onClick={() => updateTask(t.id, { isMinimized: true })}
                            title="Minimize to Background"
                            style={{ padding: "6px" }}
                        >
                            <Minimize2 size={18} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="copy-modal-close-btn"
                        onClick={() => {
                            if (isRunning) {
                                updateTask(t.id, { isMinimized: true });
                            } else {
                                removeTask(t.id);
                            }
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* 2. Scrollable Body Content (Grid + Console Logs) */}
            <div className="dashboard-scroll-body" style={{ flex: "1 1 auto", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: "20px", paddingRight: "6px", paddingBottom: "12px" }}>
                
                {/* 2.1. Final Summary Card (Visible when Completed, Failed or Cancelled) */}
                {(t.status === "completed" || t.status === "cancelled" || t.status === "failed") && (
                    <div className="dashboard-panel" style={{ height: "auto", minHeight: "160px", background: "#f8fafc", borderColor: "#cbd5e1", flex: "none", padding: "16px 20px", marginBottom: "10px" }}>
                        <div className="dashboard-panel-header" style={{ borderBottomColor: "#cbd5e1", marginBottom: "12px", paddingBottom: "6px" }}>
                            <span className="dashboard-panel-title" style={{ fontWeight: "800", color: getStatusColor(t.status) }}>
                                {t.status === "completed" ? "✓ COPY PROCESS COMPLETED" : t.status === "cancelled" ? "⚠ COPY PROCESS CANCELLED" : "❌ COPY PROCESS FAILED"}
                            </span>
                        </div>
                        <div className="dashboard-info-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px 24px" }}>
                            <div className="dashboard-info-item" style={{ borderBottom: "none", paddingBottom: "0" }}>
                                <span className="dashboard-info-label">Websites Updated:</span>
                                <strong style={{ color: "#0f172a" }}>{completedWebsites}</strong>
                            </div>
                            <div className="dashboard-info-item" style={{ borderBottom: "none", paddingBottom: "0" }}>
                                <span className="dashboard-info-label">Products Copied:</span>
                                <strong style={{ color: "#10b981" }}>{copiedProducts.toLocaleString()}</strong>
                            </div>
                            <div className="dashboard-info-item" style={{ borderBottom: "none", paddingBottom: "0" }}>
                                <span className="dashboard-info-label">Duplicate Products Skipped:</span>
                                <strong style={{ color: "#f59e0b" }}>{skippedProducts.toLocaleString()}</strong>
                            </div>
                            <div className="dashboard-info-item" style={{ borderBottom: "none", paddingBottom: "0" }}>
                                <span className="dashboard-info-label">Errors:</span>
                                <strong style={{ color: "#ef4444" }}>0</strong>
                            </div>
                            <div className="dashboard-info-item" style={{ borderBottom: "none", paddingBottom: "0" }}>
                                <span className="dashboard-info-label">Total Time:</span>
                                <strong style={{ color: "#0f172a" }}>{formatTime(elapsed)}</strong>
                            </div>
                            <div className="dashboard-info-item" style={{ borderBottom: "none", paddingBottom: "0" }}>
                                <span className="dashboard-info-label">Average Speed:</span>
                                <strong style={{ color: "#0f172a" }}>{speed} items/sec</strong>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dashboard Grid */}
                <div className="dashboard-grid-layout">
                    {/* Left Column: Task Details + Progress */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {/* Task Configuration Card */}
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <span className="dashboard-panel-title">⚙ Task Details</span>
                            </div>
                            <div className="dashboard-info-list">
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Task Type:</span>
                                    <span className="dashboard-info-value">{t.name}</span>
                                </div>
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Source Website:</span>
                                    <span className="dashboard-info-value">{t.website}</span>
                                </div>
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Concurrency:</span>
                                    <span className="dashboard-info-value">{t.config?.concurrencyLimit || 3} sites parallel</span>
                                </div>
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Queue Backlog:</span>
                                    <span className="dashboard-info-value">{remainingProducts} items left</span>
                                </div>
                            </div>
                        </div>

                        {/* Progress Status Card */}
                        <div className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <span className="dashboard-panel-title">📈 Overall Progress</span>
                                <span style={{ fontWeight: "800", color: "#2563eb" }}>{t.percent}%</span>
                            </div>
                            
                            <div style={{ width: "100%", height: "16px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden", position: "relative", marginBottom: "16px" }}>
                                <div 
                                    className="dashboard-progress-fill" 
                                    style={{ 
                                        width: `${t.percent}%`, 
                                        background: t.status === "completed" ? "#10b981" : t.status === "failed" ? "#ef4444" : "linear-gradient(90deg, #3b82f6, #6366f1)" 
                                    }}
                                ></div>
                            </div>

                            <div className="dashboard-info-list">
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Transfer Speed:</span>
                                    <span className="dashboard-info-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Activity size={14} style={{ color: "#3b82f6" }} /> {speed} items/sec
                                    </span>
                                </div>
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Elapsed Time:</span>
                                    <span className="dashboard-info-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Clock size={14} style={{ color: "#64748b" }} /> {formatTime(elapsed)}
                                    </span>
                                </div>
                                <div className="dashboard-info-item">
                                    <span className="dashboard-info-label">Time Remaining (ETA):</span>
                                    <span className="dashboard-info-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Clock size={14} style={{ color: "#64748b" }} /> {formatTime(eta)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Live Workers (Spans Double Height) */}
                    <div className="dashboard-panel double-height">
                        <div className="dashboard-panel-header">
                            <span className="dashboard-panel-title">📊 Live Progress Metrics</span>
                        </div>

                        {/* Live counters */}
                        <div className="stats-counter-grid">
                            <div className="stat-counter-box">
                                <span className="stat-counter-value" style={{ color: "#10b981" }}>{completedWebsites} / {totalWebsites}</span>
                                <span className="stat-counter-label">Websites</span>
                            </div>
                            <div className="stat-counter-box">
                                <span className="stat-counter-value" style={{ color: "#2563eb" }}>{copiedProducts}</span>
                                <span className="stat-counter-label">Products Copied</span>
                            </div>
                            <div className="stat-counter-box">
                                <span className="stat-counter-value" style={{ color: "#f59e0b" }}>{skippedProducts}</span>
                                <span className="stat-counter-label">Duplicates Skipped</span>
                            </div>
                        </div>

                        {/* Active Workers Status list */}
                        <div className="dashboard-panel-header" style={{ borderTop: "1px solid #f1f5f9", paddingTop: "8px", marginTop: "2px", marginBottom: "8px" }}>
                            <span style={{ fontSize: "10.5px" }}>Active Workers Progress</span>
                        </div>

                        <div className="dashboard-workers-list">
                            {t.sites && Object.entries(t.sites).map(([site, s]) => {
                                const processedSpeed = s.percent > 0 ? `${(s.copiedCount / Math.max(1, (Date.now() - (s.startTime || Date.now())) / 1000)).toFixed(1)} items/s` : "0.0 items/s";
                                return (
                                    <div key={site} className={`worker-status-card ${s.status}`} style={{ margin: "0", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <div className="worker-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "700" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0f172a" }}>
                                                <Globe size={14} style={{ color: "#2563eb" }} /> {site}
                                            </span>
                                            <span style={{ 
                                                fontSize: "11px", 
                                                fontWeight: "800", 
                                                color: s.status === "completed" ? "#10b981" : s.status === "failed" ? "#ef4444" : s.status === "running" ? "#2563eb" : "#64748b",
                                                background: s.status === "completed" ? "#dcfce7" : s.status === "failed" ? "#fee2e2" : s.status === "running" ? "#dbeafe" : "#f1f5f9",
                                                padding: "2px 8px",
                                                borderRadius: "12px"
                                            }}>
                                                {s.status.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Clean Worker Grid metrics */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "12px", color: "#475569" }}>
                                            <div>Progress: <strong style={{ color: "#0f172a" }}>{s.copiedCount} / {s.totalCount} ({s.percent}%)</strong></div>
                                            <div>Speed: <strong style={{ color: "#0f172a" }}>{processedSpeed}</strong></div>
                                            
                                            {t.name !== "Product Copy" && s.currentCat && <div style={{ gridColumn: "span 2" }}>Category: <strong style={{ color: "#0f172a" }}>{s.currentCat}</strong></div>}
                                            {t.name !== "Product Copy" && s.currentSub && <div style={{ gridColumn: "span 2" }}>Subcategory: <strong style={{ color: "#0f172a" }}>{s.currentSub}</strong></div>}
                                            {s.currentProd && <div style={{ gridColumn: "span 2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Product: <strong style={{ color: "#0f172a" }}>{s.currentProd}</strong></div>}
                                        </div>

                                        {/* Progress indicator bar */}
                                        <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                                            <div 
                                                style={{ 
                                                    width: `${s.percent}%`, 
                                                    height: "100%", 
                                                    background: s.status === "completed" ? "#10b981" : s.status === "failed" ? "#ef4444" : "#3b82f6",
                                                    transition: "width 0.3s ease"
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Console Output Panel */}
                <div className="logs-console-panel" style={{ flex: "none" }}>
                    <div className="logs-console-header" style={{ marginBottom: "12px", borderBottom: "1px solid #1e293b", paddingBottom: "8px" }}>
                        <span className="logs-console-title" style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8" }}>
                            <Terminal size={14} /> LIVE CONSOLE OUTPUT
                        </span>
                    </div>
                    
                    <div className="logs-console-stream" ref={consoleStreamRef} onScroll={handleConsoleScroll}>
                        {(!t.logs || t.logs.length === 0) ? (
                            <div style={{ color: "#475569", fontStyle: "italic", padding: "40px 0", textAlign: "center" }}>
                                Console stream is empty.
                            </div>
                        ) : (
                            t.logs.map((log, index) => {
                                let logColor = "#e2e8f0";
                                if (log.includes("✔") || log.includes("success")) logColor = "#4ade80";
                                if (log.includes("❌") || log.includes("Error") || log.includes("failed")) logColor = "#f87171";
                                if (log.includes("⚠") || log.includes("warning") || log.includes("paused")) logColor = "#fbbf24";
                                if (log.includes("[Diagnostic]") || log.includes("START") || log.includes("END")) logColor = "#38bdf8";
                                return (
                                    <div key={index} style={{ color: logColor }}>
                                        {log}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Footer controls (Sticky/Fixed at Bottom) */}
            <div 
                className="copy-modal-footer" 
                style={{ 
                    flex: "none",
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    borderTop: "1px solid #f1f5f9", 
                    paddingTop: "14px", 
                    marginTop: "12px" 
                }}
            >
                {/* Footer status left */}
                <div className="dashboard-footer-status">
                    <span 
                        style={{ 
                            width: "8px", 
                            height: "8px", 
                            borderRadius: "50%", 
                            background: getStatusColor(t.status),
                            boxShadow: `0 0 8px ${getStatusColor(t.status)}`
                        }}
                    ></span>
                    <span>
                        Status: <strong style={{ color: getStatusColor(t.status) }}>{t.status.toUpperCase()}</strong>
                        {isPaused && <span style={{ color: "#f59e0b" }}> (PAUSED)</span>}
                    </span>
                </div>

                {/* Actions right */}
                <div style={{ display: "flex", gap: "10px" }}>
                    {isRunning && (
                        <>
                            <button
                                type="button"
                                className="copy-btn-secondary"
                                onClick={handlePauseToggle}
                                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "13px" }}
                            >
                                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                                {isPaused ? "Resume" : "Pause"}
                            </button>
                            <button
                                type="button"
                                className="copy-btn-secondary"
                                onClick={t.cancelHandler}
                                style={{ display: "flex", alignItems: "center", gap: "6px", borderColor: "#fca5a5", color: "#dc2626", padding: "8px 16px", fontSize: "13px" }}
                            >
                                <X size={14} /> Cancel Process
                            </button>
                            <button
                                type="button"
                                className="copy-btn-primary"
                                onClick={() => updateTask(t.id, { isMinimized: true })}
                                style={{ padding: "8px 16px", fontSize: "13px" }}
                            >
                                Hide Window
                            </button>
                        </>
                    )}
                    
                    {!isRunning && (
                        <button
                            type="button"
                            className="copy-btn-primary"
                            onClick={() => removeTask(t.id)}
                            style={{ padding: "8px 20px", fontSize: "13px" }}
                        >
                            Close Dashboard
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function FloatingTaskManager() {
    const { tasks, updateTask, removeTask, formatTime } = useTaskManager();
    
    // Position state for the minimized floating window
    const [pos, setPos] = useState({ x: 20, y: 80 }); 
    const [dragging, setDragging] = useState(false);
    const relRef = useRef({ x: 0, y: 0 });
    const managerRef = useRef(null);

    // Initialize position on client mount
    useEffect(() => {
        setPos({ x: window.innerWidth - 380, y: 100 });
    }, []);

    // Prevent body scrolling when global modal is expanded
    useEffect(() => {
        const hasExpanded = Object.values(tasks).some(t => !t.isMinimized);
        if (hasExpanded) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [tasks]);

    const handleMouseDown = (e) => {
        if (e.target.closest(".drag-handle")) {
            setDragging(true);
            relRef.current = {
                x: e.clientX - pos.x,
                y: e.clientY - pos.y
            };
            e.preventDefault();
        }
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragging) return;
            const newX = Math.max(0, Math.min(window.innerWidth - 360, e.clientX - relRef.current.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - relRef.current.y));
            setPos({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setDragging(false);
        };

        if (dragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [dragging, pos]);

    const activeTasks = Object.values(tasks);
    if (activeTasks.length === 0) return null;

    const minimizedTasks = activeTasks.filter(t => t.isMinimized);
    const expandedTasks = activeTasks.filter(t => !t.isMinimized);

    return (
        <>
            {/* 1. EXPANDED FULL MODALS (rendered via Portal Modal directly on body) */}
            {expandedTasks.map(t => (
                <PortalModal
                    key={t.id}
                    isOpen={true}
                    onClose={() => {
                        if (t.status !== "running") {
                            removeTask(t.id);
                        }
                    }}
                >
                    <ExpandedTaskDashboard
                        t={t}
                        removeTask={removeTask}
                        updateTask={updateTask}
                        formatTime={formatTime}
                    />
                </PortalModal>
            ))}

            {/* 2. MINIMIZED FLOATING WINDOW */}
            {minimizedTasks.length > 0 && (
                <div
                    ref={managerRef}
                    onMouseDown={handleMouseDown}
                    style={{
                        position: "fixed",
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                        width: "350px",
                        backgroundColor: "#1e293b",
                        color: "#f8fafc",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
                        zIndex: 99999,
                        border: "1px solid #334155",
                        overflow: "hidden"
                    }}
                >
                    {/* Header */}
                    <div
                        className="drag-handle"
                        style={{
                            padding: "10px 14px",
                            background: "#0f172a",
                            borderBottom: "1px solid #334155",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "move",
                            userSelect: "none"
                        }}
                    >
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            ⚙ Background Tasks ({minimizedTasks.length})
                        </span>
                        <span style={{ fontSize: "10px", color: "#94a3b8" }}>Drag Me</span>
                    </div>

                    {/* Tasks list */}
                    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "350px", overflowY: "auto" }}>
                        {minimizedTasks.map(t => (
                            <div
                                key={t.id}
                                style={{
                                    background: "#1e293b",
                                    border: "1px solid #334155",
                                    borderRadius: "8px",
                                    padding: "10px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "6px"
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#ffffff" }}>
                                        {t.name}
                                    </span>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <button
                                            type="button"
                                            title="Expand Task View"
                                            onClick={() => updateTask(t.id, { isMinimized: false })}
                                            style={{
                                                background: "rgba(255,255,255,0.06)",
                                                border: "none",
                                                color: "#38bdf8",
                                                borderRadius: "4px",
                                                padding: "4px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center"
                                            }}
                                        >
                                            <Maximize2 size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            title={t.status === "running" ? "Cancel Task" : "Dismiss"}
                                            onClick={() => {
                                                if (t.status === "running") {
                                                    t.cancelHandler();
                                                } else {
                                                    removeTask(t.id);
                                                }
                                            }}
                                            style={{
                                                background: "rgba(255,255,255,0.06)",
                                                border: "none",
                                                color: t.status === "running" ? "#ef4444" : "#cbd5e1",
                                                borderRadius: "4px",
                                                padding: "4px",
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center"
                                            }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    Website: <strong>{t.website}</strong>
                                </div>

                                {/* Progress bar */}
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
                                    <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
                                        <div
                                            style={{
                                                height: "100%",
                                                width: `${t.percent}%`,
                                                background: t.status === "completed" ? "#10b981" : t.status === "failed" ? "#ef4444" : t.status === "cancelled" ? "#f59e0b" : "linear-gradient(90deg, #38bdf8, #6366f1)"
                                            }}
                                        ></div>
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#38bdf8", width: "30px", textAlign: "right" }}>
                                        {t.percent}%
                                    </span>
                                </div>

                                {/* Speed / ETA */}
                                {t.status === "running" && (
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#cbd5e1", borderTop: "1px dashed rgba(255,255,255,0.06)", paddingTop: "4px", marginTop: "2px" }}>
                                        <span>Copied: <strong>{t.stats?.copiedProducts} / {t.stats?.totalProducts}</strong></span>
                                        <span>ETA: <strong>{formatTime(t.stats?.eta)}</strong></span>
                                    </div>
                                )}
                                
                                {t.status !== "running" && (
                                    <div style={{ fontSize: "10.5px", fontWeight: "600", color: t.status === "completed" ? "#4ade80" : t.status === "cancelled" ? "#fbbf24" : "#f87171" }}>
                                        Status: {t.status.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
