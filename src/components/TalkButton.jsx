//components/TalkButton.jsx
import React from "react";
import { playBeep } from "../utils/beep";
import { vibrate } from "../utils/vibrate";

/**
 * TalkButton component
 * Props:
 * status: 'IDLE' | 'REQUESTING' | 'TALKING' | 'LOCKED'
 * onPress: function called when button is pressed/held
 * onRelease: function called when button is released
 * className: extra classes for styling/positioning
 */
export default function TalkButton({ status = 'IDLE', onPress, onRelease, className = "" }) {
  
  // Ánh xạ trạng thái sang màu sắc (Tailwind classes)
  const getButtonStyles = () => {
    switch (status) {
      case 'TALKING':
        return "bg-green-600 border-green-800 ring-4 ring-green-400"; // Xanh lá khi có mic
      case 'REQUESTING':
        return "bg-yellow-500 border-yellow-700"; // Vàng chờ cấp mic
      case 'LOCKED':
        return "bg-gray-400 border-gray-600 cursor-not-allowed opacity-70"; // Xám khi người khác đang nói
      case 'IDLE':
      default:
        return "bg-red-600 border-red-800"; // Đỏ mặc định
    }
  };

  // Ánh xạ trạng thái sang Text hiển thị
  const getButtonText = () => {
    switch (status) {
      case 'TALKING': return "Recording...";
      case 'REQUESTING': return "Connecting...";
      case 'LOCKED': return "Channel Busy";
      case 'IDLE':
      default: return "Hold To Talk";
    }
  };

  const handlePress = (e) => {
    if (status === 'LOCKED') return; // Không cho bấm nếu kênh đang bận
    playBeep(); 
    vibrate(60); 
    if (onPress) onPress(e);
  };

  const handleRelease = (e) => {
    if (status === 'LOCKED') return;
    // Tùy chỉnh: Chỉ kêu bíp nhả mic nếu trước đó thực sự đang TALKING
    if (status === 'TALKING' || status === 'REQUESTING') {
      playBeep(); 
      vibrate(40); 
    }
    if (onRelease) onRelease(e);
  };

  return (
    <button
      className={`w-48 h-48 rounded-full shadow-lg border-4 transition-all duration-200 flex flex-col items-center justify-center select-none text-white font-bold text-xl ${getButtonStyles()} ${status !== 'LOCKED' ? 'active:scale-95' : ''} ${className}`}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      aria-pressed={status === 'TALKING'}
      disabled={status === 'LOCKED'}
      type="button"
    >
      {getButtonText()}
    </button>
  );
}