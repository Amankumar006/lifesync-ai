import React from "react";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";
import { COLORS } from "../../constants/colors";

export interface IconProps {
  size?: number;
  active?: boolean;
  color?: string;
}

export function ChatIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect
        x="5"
        y="5"
        width="22"
        height="22"
        rx="6"
        stroke={strokeColor}
        strokeWidth="1.6"
      />
      <Rect
        x="10"
        y="13"
        width="12"
        height="2.4"
        rx="1.2"
        fill={fillColor}
        opacity={active ? 1.0 : 0.4}
      />
      <Rect
        x="10"
        y="18"
        width="8"
        height="2.4"
        rx="1.2"
        fill={fillColor}
        opacity={active ? 0.5 : 0.2}
      />
    </Svg>
  );
}

export function PlanIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = active ? COLORS.lavender : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect
        x="5"
        y="6"
        width="22"
        height="20"
        rx="4"
        stroke={strokeColor}
        strokeWidth="1.6"
      />
      <Path d="M5 12h22" stroke={strokeColor} strokeWidth="1.6" />
      <Rect
        x="8"
        y="16"
        width="5"
        height="5"
        rx="1.5"
        fill={fillColor}
        opacity={active ? 1.0 : 0.4}
      />
      <Rect
        x="15"
        y="16"
        width="5"
        height="5"
        rx="1.5"
        fill={fillColor}
        opacity={active ? 0.4 : 0.25}
      />
    </Svg>
  );
}

export function TasksIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="5"
        stroke={strokeColor}
        strokeWidth="1.6"
      />
      <Path
        d="M11 16l3 3 7-7"
        stroke={COLORS.green}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function NotesIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = active ? COLORS.lavender : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M8 5h13l3 3v19H8V5z"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Rect
        x="11"
        y="12"
        width="9"
        height="1.8"
        rx="0.9"
        fill={fillColor}
        opacity={active ? 1.0 : 0.4}
      />
      <Rect
        x="11"
        y="16"
        width="9"
        height="1.8"
        rx="0.9"
        fill={fillColor}
        opacity={active ? 0.5 : 0.25}
      />
      <Rect
        x="11"
        y="20"
        width="6"
        height="1.8"
        rx="0.9"
        fill={fillColor}
        opacity={active ? 0.5 : 0.25}
      />
    </Svg>
  );
}

export function ProfileIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="11" r="5" stroke={strokeColor} strokeWidth="1.6" />
      <Path
        d="M6 27c0-5.5 4.5-9 10-9s10 3.5 10 9"
        stroke={strokeColor}
        strokeWidth="1.6"
        fill="none"
      />
      <Circle
        cx="16"
        cy="11"
        r="5"
        fill={fillColor}
        opacity={active ? 0.25 : 0.1}
      />
    </Svg>
  );
}

export function CriticalIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = COLORS.accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 4l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M16 4l3 6 7 1-5 5 1 7-6-3z"
        fill={fillColor}
        opacity={active ? 0.3 : 0.1}
      />
    </Svg>
  );
}

export function DeadlineIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = COLORS.lavender;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx="16" cy="16" r="11" stroke={strokeColor} strokeWidth="1.6" />
      <Path
        d="M16 9v7l5 3"
        stroke={fillColor}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function LocationIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = COLORS.green;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 6c-4 0-7 3-7 7 0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z"
        stroke={strokeColor}
        strokeWidth="1.6"
        fill="none"
      />
      <Circle cx="16" cy="13" r="3" fill={fillColor} opacity={active ? 0.4 : 0.15} />
    </Svg>
  );
}

export function CalendarIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect
        x="7"
        y="9"
        width="18"
        height="14"
        rx="2.5"
        stroke={strokeColor}
        strokeWidth="1.6"
      />
      <Path d="M7 12h18" stroke={strokeColor} strokeWidth="1.6" />
      <Circle cx="11" cy="10.5" r="0.8" fill={COLORS.accent} />
      <Circle cx="14" cy="10.5" r="0.8" fill={COLORS.accent} />
    </Svg>
  );
}

export function MovieIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = COLORS.green;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M6 26l5-15 5 10 4-7 6 12z"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="22" cy="9" r="2.5" fill={fillColor} opacity={active ? 0.4 : 0.15} />
    </Svg>
  );
}

export function GymIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 4v6M16 22v6M4 16h6M22 16h6"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Circle
        cx="16"
        cy="16"
        r="5"
        fill={COLORS.accent}
        opacity={active ? 0.3 : 0.1}
      />
      <Circle
        cx="16"
        cy="16"
        r="5"
        stroke={COLORS.accent}
        strokeWidth="1.6"
        fill="none"
      />
    </Svg>
  );
}

export function LockIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = COLORS.lavender;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M6 12h20l-2 13H8z"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M11 12V9a5 5 0 0110 0v3"
        stroke={strokeColor}
        strokeWidth="1.6"
        fill="none"
      />
      <Rect
        x="13"
        y="16"
        width="6"
        height="5"
        rx="1"
        fill={fillColor}
        opacity={active ? 0.35 : 0.15}
      />
    </Svg>
  );
}

export function WakeIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 5v3M16 24v3M5 16h3M24 16h3M8.5 8.5l2 2M21.5 21.5l2 2M23.5 8.5l-2 2M10.5 21.5l-2 2"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Circle
        cx="16"
        cy="16"
        r="5"
        fill={COLORS.yellow}
        opacity={active ? 0.35 : 0.15}
      />
      <Circle
        cx="16"
        cy="16"
        r="5"
        stroke={COLORS.yellow}
        strokeWidth="1.6"
        fill="none"
      />
    </Svg>
  );
}

export function AIIcon({ size = 32, active = false, color }: IconProps) {
  const fillColor = color || (active ? COLORS.lavender : COLORS.textDim);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 4l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill={fillColor} />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color }: IconProps) {
  const strokeColor = color || COLORS.bg;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({ size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={COLORS.textDim} strokeWidth="2" />
      <Path
        d="M20 20l-3-3"
        stroke={COLORS.textDim}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function AddIcon({ size = 24, color }: IconProps) {
  const strokeColor = color || COLORS.bg;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CameraIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M10 8l1.5-3h9L22 8"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect
        x="5"
        y="8"
        width="22"
        height="17"
        rx="3"
        stroke={strokeColor}
        strokeWidth="1.6"
      />
      <Circle
        cx="16"
        cy="17"
        r="5"
        stroke={strokeColor}
        strokeWidth="1.6"
        fill="none"
      />
      <Circle
        cx="16"
        cy="17"
        r="5"
        fill={fillColor}
        opacity={active ? 0.25 : 0.1}
      />
    </Svg>
  );
}

export function MicIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const fillColor = active ? COLORS.accent : COLORS.textDim;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect
        x="12"
        y="4"
        width="8"
        height="16"
        rx="4"
        stroke={strokeColor}
        strokeWidth="1.6"
        fill={fillColor}
        opacity={active ? 0.25 : 0.1}
      />
      <Rect
        x="12"
        y="4"
        width="8"
        height="16"
        rx="4"
        stroke={strokeColor}
        strokeWidth="1.6"
        fill="none"
      />
      <Line
        x1="16"
        y1="22"
        x2="16"
        y2="27"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Line
        x1="11"
        y1="27"
        x2="21"
        y2="27"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function WaveformIcon({ size = 32, active = false }: IconProps) {
  const strokeColor = active ? COLORS.accent : COLORS.textDim;
  const barWidth = 2;
  const gap = 3;
  const heights = [8, 14, 18, 12, 6];
  const totalWidth = heights.length * barWidth + (heights.length - 1) * gap;
  const startX = (32 - totalWidth) / 2;
  const centerY = 16;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {heights.map((h, i) => {
        const x = startX + i * (barWidth + gap);
        const y = centerY - h / 2;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={1}
            fill={strokeColor}
            opacity={active ? 1.0 : 0.5}
          />
        );
      })}
    </Svg>
  );
}
