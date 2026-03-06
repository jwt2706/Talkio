import { useState, useEffect, useRef, useCallback } from "react";
import { getElectronMqttClient } from "../utils/electronMqttClient";

export default function useFloorControl(activeChannelId) {
  const [status, setStatus] = useState("IDLE"); // IDLE, REQUESTING, TALKING, LOCKED
  const [isConnected, setIsConnected] = useState(false);

  const clientRef = useRef(null);
  const topicRef = useRef(null);

  const myClientId = useRef(
    `device_${Math.random().toString(36).substring(2, 9)}`
  ).current;

  useEffect(() => {
    let cancelled = false;

    const client = getElectronMqttClient();
    clientRef.current = client;

    const topic = `skytrac/talkgroup/${activeChannelId}`;
    topicRef.current = topic;

    const onConnect = () => {
      console.log("[MQTT] connected");
      setIsConnected(true);
    };

    const onReconnect = () => {
      console.warn("[MQTT] reconnecting...");
      setIsConnected(false);
    };

    const onClose = () => {
      console.warn("[MQTT] socket closed");
      setIsConnected(false);
    };

    const onOffline = () => {
      console.warn("[MQTT] offline");
      setIsConnected(false);
    };

    const onEnd = () => {
      console.warn("[MQTT] ended");
      setIsConnected(false);
    };

    const onError = (err) => {
      console.error("[MQTT] error:", err);
      setIsConnected(false);
    };

    const onMessage = (receivedTopic, message) => {
      if (receivedTopic !== topicRef.current) return;

      const text =
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message);

      console.log("[MQTT] message received", receivedTopic, text);

      try {
        const payload = JSON.parse(text);

        if (payload.clientId === myClientId) return;

        if (payload.action === "mic_taken") {
          setStatus((prev) => (prev === "TALKING" ? "TALKING" : "LOCKED"));
        } else if (payload.action === "mic_freed") {
          setStatus("IDLE");
        }
      } catch (err) {
        console.error("[MQTT] JSON parse error", err, text);
      }
    };

    client.on("connect", onConnect);
    client.on("reconnect", onReconnect);
    client.on("close", onClose);
    client.on("offline", onOffline);
    client.on("end", onEnd);
    client.on("error", onError);
    client.on("message", onMessage);

    async function init() {
      try {
        await client.connect();
        if (cancelled) return;

        setIsConnected(!!client.connected);

        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            console.error("[MQTT] subscribe failed:", topic, err);
            return;
          }
          console.log("[MQTT] subscribed to", topic);
          setStatus("IDLE");
        });
      } catch (err) {
        console.error("[MQTT] init failed:", err);
        setIsConnected(false);
      }
    }

    init();

    return () => {
      cancelled = true;

      try {
        client.unsubscribe(topic);
      } catch {}

      client.removeListener("connect", onConnect);
      client.removeListener("reconnect", onReconnect);
      client.removeListener("close", onClose);
      client.removeListener("offline", onOffline);
      client.removeListener("end", onEnd);
      client.removeListener("error", onError);
      client.removeListener("message", onMessage);
    };
  }, [activeChannelId, myClientId]);

  const requestMic = useCallback(() => {
    const client = clientRef.current;
    const topic = topicRef.current;

    if (status === "LOCKED") return;

    if (!client || !client.connected) {
      console.warn("[PTT] cannot request mic: MQTT not connected");
      return;
    }

    setStatus("REQUESTING");

    const payload = JSON.stringify({
      clientId: myClientId,
      action: "mic_taken",
      ts: Date.now(),
    });

    console.log("[PTT] publishing mic_taken", { topic, payload });

    client.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error("[PTT] publish mic_taken failed", err);
        setStatus("IDLE");
        return;
      }

      setStatus("TALKING");
    });
  }, [status, myClientId]);

  const releaseMic = useCallback(() => {
    const client = clientRef.current;
    const topic = topicRef.current;

    if (status !== "TALKING") return;

    setStatus("IDLE");

    if (!client || !client.connected) {
      console.warn("[PTT] cannot release mic: MQTT not connected");
      return;
    }

    const payload = JSON.stringify({
      clientId: myClientId,
      action: "mic_freed",
      ts: Date.now(),
    });

    console.log("[PTT] publishing mic_freed", { topic, payload });

    client.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error("[PTT] publish mic_freed failed", err);
      }
    });
  }, [status, myClientId]);

  return {
    status,
    requestMic,
    releaseMic,
    client: clientRef.current,
    isConnected,
  };
}