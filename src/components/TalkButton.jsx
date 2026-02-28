import React from "react";

/**
 * BigRedButton component
 * Props:
 *   onPress: function called when button is pressed/held
 *   onRelease: function called when button is released
 *   className: extra classes for styling/positioning
 */
export default function TalkButton({ onPress, onRelease, className = "" }) {
  const [isPressed, setIsPressed] = React.useState(false);

  const handlePress = (e) => {
    setIsPressed(true);
    if (onPress) onPress(e);
  };
  const handleRelease = (e) => {
    setIsPressed(false);
    if (onRelease) onRelease(e);
  };

  return (
    <button
      className={`w-45 h-45 rounded-full bg-red-600 shadow-lg border-4 border-red-800 active:scale-95 transition-transform duration-100 flex items-center justify-center select-none ${isPressed ? "ring-4 ring-red-400" : ""} ${className}`}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      aria-pressed={isPressed}
      type="button"
    >
      {/* Optionally add icon/text here */}
    </button>
  );
}
