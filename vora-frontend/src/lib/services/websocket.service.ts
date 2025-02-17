import { config } from '../config'
import { Task } from './task.service'

export type MessageHandler = (message: WebSocketMessage) => void

export interface WebSocketMessage {
  type: string
  data: Task | Record<string, unknown>
}

export interface AgentActivity {
  agent_id: string;
  activity: string;
  details: Record<string, string | number | boolean | null>;
}

export interface TaskProgress {
  task_id: string;
  progress: number;
  status: string;
  current_action: string | null;
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private messageHandlers: Set<MessageHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isConnecting = false

  connect(): WebSocket | null {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return this.ws
    }

    if (this.isConnecting) {
      return null
    }

    this.isConnecting = true

    try {
      this.ws = new WebSocket(config.wsUrl)
      
      this.ws.onmessage = this.onmessage.bind(this)
      this.ws.onerror = this.onerror.bind(this)
      this.ws.onclose = this.onclose.bind(this)
      this.ws.onopen = this.onopen.bind(this)

      return this.ws
    } catch (error) {
      console.error('WebSocket connection error:', error)
      this.isConnecting = false
      this.attemptReconnect()
      return null
    }
  }

  private onmessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage
      
      // Handle connection status messages
      if (message.type === 'connection_status') {
        console.log('Connection status:', message.data.status)
      }

      this.messageHandlers.forEach(handler => {
        try {
          handler(message)
        } catch (error) {
          console.error('Error in message handler:', error)
        }
      })
    } catch (error) {
      console.error('Error parsing WebSocket message:', error)
    }
  }

  private onerror() {
    console.error('WebSocket error')
    this.attemptReconnect()
  }

  private onclose() {
    console.log('WebSocket closed')
    this.isConnecting = false
    this.attemptReconnect()
  }

  private onopen() {
    console.log('WebSocket connected')
    this.isConnecting = false
    this.reconnectAttempts = 0
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    this.reconnectAttempts = 0
    this.isConnecting = false
  }

  addMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.add(handler)
  }

  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.delete(handler)
  }
}

export const websocketService = new WebSocketService();