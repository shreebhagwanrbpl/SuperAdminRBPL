"use client";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function PortalModal({ isOpen, onClose, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="copy-modal-box">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
