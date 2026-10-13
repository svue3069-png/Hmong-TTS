/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Task Coordinator & Global Playback Manager
 * Central authority that tracks and coordinates all active audio playback,
 * speech synthesis, dictation, video playback, and background tasks.
 * 
 * Guarantees that:
 * 1. Switching tabs inside the app stops the current task.
 * 2. Switching browser tabs, minimizing the window, or losing window focus stops the current task.
 * 3. Starting a new task cleanly halts any conflicting prior task.
 */

import { hmongTTS } from './hmongAudioSynthesizer';
import { speechCoordinator } from './multilingualCoordinator';
import { webSpeech } from './webSpeechEngine';

export type TaskStopReason =
  | 'tab_changed'
  | 'visibility_hidden'
  | 'window_blur'
  | 'page_hide'
  | 'before_unload'
  | 'task_changed'
  | 'user_stopped'
  | 'new_task_started'
  | 'modal_opened'
  | 'preset_changed'
  | 'voice_changed'
  | 'dialect_changed'
  | 'mode_changed';

type StopHandler = (reason: TaskStopReason) => void;

class TaskCoordinator {
  private stopHandlers: Map<string, StopHandler> = new Map();
  private isInitialized = false;
  private currentActiveTask: string | null = null;

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. When user switches away from the browser tab or minimizes window
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopAll('visibility_hidden');
      }
    });

    // 2. When the window or screen loses focus (switching to another window/app)
    window.addEventListener('blur', () => {
      this.stopAll('window_blur');
    });

    // 3. Page unload or navigation away
    window.addEventListener('pagehide', () => {
      this.stopAll('page_hide');
    });

    window.addEventListener('beforeunload', () => {
      this.stopAll('before_unload');
    });
  }

  /**
   * Registers a component's cleanup/stop callback.
   * Returns an unregister function for useEffect cleanup.
   */
  public registerStopHandler(id: string, handler: StopHandler): () => void {
    this.stopHandlers.set(id, handler);
    return () => {
      this.stopHandlers.delete(id);
    };
  }

  /**
   * Unregisters a stop handler.
   */
  public unregisterStopHandler(id: string): void {
    this.stopHandlers.delete(id);
  }

  /**
   * Notifies the coordinator that a new task has started.
   * Automatically stops any conflicting tasks.
   */
  public notifyTaskStarted(taskId: string): void {
    if (this.currentActiveTask && this.currentActiveTask !== taskId) {
      this.stopAllExcept(taskId, 'new_task_started');
    }
    this.currentActiveTask = taskId;
  }

  /**
   * Clears the current active task identifier.
   */
  public notifyTaskEnded(taskId: string): void {
    if (this.currentActiveTask === taskId) {
      this.currentActiveTask = null;
    }
  }

  /**
   * Stops all active tasks, audio playback, speech engines, and video across the entire app.
   */
  public stopAll(reason: TaskStopReason = 'user_stopped'): void {
    this.currentActiveTask = null;

    // 1. Stop core TTS audio engines
    try {
      hmongTTS.stop();
    } catch (_) {}

    try {
      speechCoordinator.stop();
    } catch (_) {}

    try {
      webSpeech.stop();
    } catch (_) {}

    // 2. Pause any playing HTML5 <audio> or <video> media elements in the DOM
    if (typeof document !== 'undefined') {
      try {
        const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
        mediaElements.forEach((el) => {
          try {
            if (!el.paused) {
              el.pause();
            }
          } catch (_) {}
        });
      } catch (_) {}

      // 3. Pause any embedded YouTube iframes via postMessage API
      try {
        const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
        iframes.forEach((iframe) => {
          try {
            iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          } catch (_) {}
        });
      } catch (_) {}
    }

    // 4. Invoke all registered component stop handlers
    this.stopHandlers.forEach((handler) => {
      try {
        handler(reason);
      } catch (err) {
        console.warn('Task stop handler note:', err);
      }
    });
  }

  /**
   * Stops all tasks except the specified task ID.
   */
  public stopAllExcept(exceptTaskId: string, reason: TaskStopReason = 'new_task_started'): void {
    // Stop core TTS engines if the new task isn't the core TTS engine itself
    if (exceptTaskId !== 'hmong_tts_core' && exceptTaskId !== 'studio_player') {
      try {
        hmongTTS.stop();
      } catch (_) {}
      try {
        speechCoordinator.stop();
      } catch (_) {}
      try {
        webSpeech.stop();
      } catch (_) {}
    }

    // Pause other media elements
    if (typeof document !== 'undefined') {
      try {
        const mediaElements = document.querySelectorAll<HTMLMediaElement>('audio, video');
        mediaElements.forEach((el) => {
          try {
            // Do not pause if this element belongs to the excepted task
            if ((el as any).dataset?.taskId !== exceptTaskId && !el.paused) {
              el.pause();
            }
          } catch (_) {}
        });
      } catch (_) {}

      if (exceptTaskId !== 'video_player') {
        try {
          const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
          iframes.forEach((iframe) => {
            try {
              iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            } catch (_) {}
          });
        } catch (_) {}
      }
    }

    // Invoke registered handlers except the current one
    this.stopHandlers.forEach((handler, id) => {
      if (id !== exceptTaskId) {
        try {
          handler(reason);
        } catch (err) {
          console.warn('Task stop handler note:', err);
        }
      }
    });
  }
}

// Global Singleton Instance
export const taskCoordinator = new TaskCoordinator();
