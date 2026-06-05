export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export type ClientMessage =
  | {
      type: "control";
      paused: boolean;
      clientTs: number;
    }
  | {
      type: "ping";
      clientTs: number;
    }
  | {
      type: "reset";
      clientTs: number;
    };

export type ServerStateMessage = {
  type: "state";
  serverTs: number;
  groundHits: number;
  rainRate: number;
  paused: boolean;
  connectedClients: number;
  tick: number;
};

export type ServerPongMessage = {
  type: "pong";
  serverTs: number;
  clientTs: number;
};

export type ServerMessage = ServerStateMessage | ServerPongMessage;

export type ActivityEntry = {
  id: number;
  text: string;
  ts: number;
};

