// hooks/useFloorControl.js
import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';

export default function useFloorControl(activeChannelId) {
  const [status, setStatus] = useState('IDLE'); // IDLE, REQUESTING, TALKING, LOCKED
  const clientRef = useRef(null);
  const myClientId = useRef(`device_${Math.random().toString(36).substring(2, 9)}`).current;

  useEffect(() => {
    const client = mqtt.connect('wss://159.203.3.86:9001');
    clientRef.current = client;
    const topic = `skytrac/talkgroup/${activeChannelId}`;

    client.on('connect', () => {
      console.log(`Connected to MQTT. Subscribing to ${topic}`);
      client.subscribe(topic);
      setStatus('IDLE'); 
    });

    client.on('message', (receivedTopic, message) => {
      if (receivedTopic !== topic) return;

      try {
        const payload = JSON.parse(message.toString());
        if (payload.clientId === myClientId) return;

        if (payload.action === 'mic_taken') {
          setStatus(prev => prev === 'TALKING' ? 'TALKING' : 'LOCKED');
        } else if (payload.action === 'mic_freed') {
          setStatus('IDLE');
        }
      } catch (err) {
        console.error("Lỗi parse MQTT message", err);
      }
    });

    return () => {
      client.unsubscribe(topic);
      client.end();
    };
  }, [activeChannelId]);

  const requestMic = () => {
    if (status === 'LOCKED') return;
    setStatus('REQUESTING');
    const payload = JSON.stringify({ clientId: myClientId, action: 'mic_taken' });
    clientRef.current.publish(`skytrac/talkgroup/${activeChannelId}`, payload);
    setTimeout(() => {
      setStatus('TALKING');
    }, 200);
  };

  const releaseMic = () => {
    if (status !== 'TALKING') return;
    setStatus('IDLE');
    const payload = JSON.stringify({ clientId: myClientId, action: 'mic_freed' });
    clientRef.current.publish(`skytrac/talkgroup/${activeChannelId}`, payload);
  };

  return { status, requestMic, releaseMic,
    client: clientRef.current
   };
}