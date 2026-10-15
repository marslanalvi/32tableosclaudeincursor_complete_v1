import { useState } from "react";
import type { InputProps } from "./Input.js";
import styles from "./primitives.module.css";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      {open ? null : <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

/** Password field with an eye button that shows or hides what was typed. */
export function PasswordInput({ className, ...rest }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  const merged = `${className ?? styles["input"]} ${styles["passwordInput"]}`;
  return (
    <span className={styles["passwordWrap"]}>
      <input {...rest} className={merged} type={visible ? "text" : "password"} />
      <button
        type="button"
        className={styles["passwordToggle"]}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
      >
        <EyeIcon open={visible} />
      </button>
    </span>
  );
}
