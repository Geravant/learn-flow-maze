// Generic Loading Service
// Manages loading states, placeholder content, and progressive loading for any content type

import { EventEmitter } from 'events';
import { CardContent, CardSection, PlaceholderProvider, LoadingProgress } from '../interfaces';

export interface LoadingTask {
  id: string;
  type: 'content' | 'section' | 'asset';
  cardId: string;
  sectionIndex?: number;
  priority: number;
  startTime: Date;
  estimatedDuration?: number;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LoadingState {
  isLoading: boolean;
  activeTasks: Map<string, LoadingTask>;
  completedTasks: number;
  totalTasks: number;
  overallProgress: number;
  estimatedTimeRemaining?: number;
}

export interface LoadingServiceConfig {
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  progressUpdateInterval?: number;
  enablePlaceholders?: boolean;
  placeholderProvider?: PlaceholderProvider;
  priorityThresholds?: {
    critical: number;
    high: number;
    normal: number;
    low: number;
  };
}

const DEFAULT_CONFIG: Required<LoadingServiceConfig> = {
  maxConcurrentTasks: 3,
  taskTimeout: 30000, // 30 seconds
  progressUpdateInterval: 500, // 0.5 seconds
  enablePlaceholders: true,
  placeholderProvider: {
    generatePlaceholder: () => ({ type: 'text', content: 'Loading...' })
  } as PlaceholderProvider,
  priorityThresholds: {
    critical: 100,
    high: 80,
    normal: 50,
    low: 20
  }
};

export class GenericLoadingService extends EventEmitter {
  private config: Required<LoadingServiceConfig>;
  private loadingState: LoadingState;
  private taskQueue: LoadingTask[] = [];
  private runningTasks: Map<string, Promise<any>> = new Map();
  private progressTimer: NodeJS.Timeout | null = null;
  private taskIdCounter = 0;

  constructor(config: LoadingServiceConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadingState = {
      isLoading: false,
      activeTasks: new Map(),
      completedTasks: 0,
      totalTasks: 0,
      overallProgress: 0
    };

    this.startProgressTracking();
  }

  // Queue a loading task
  queueTask(
    type: LoadingTask['type'],
    cardId: string,
    priority: number = this.config.priorityThresholds.normal,
    options: {
      sectionIndex?: number;
      estimatedDuration?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const taskId = `${type}-${cardId}-${Date.now()}-${this.taskIdCounter++}`;
    
    const task: LoadingTask = {
      id: taskId,
      type,
      cardId,
      sectionIndex: options.sectionIndex,
      priority,
      startTime: new Date(),
      estimatedDuration: options.estimatedDuration,
      progress: 0,
      status: 'pending',
      metadata: options.metadata
    };

    this.taskQueue.push(task);
    this.sortTaskQueue();
    this.updateLoadingState();
    
    this.emit('taskQueued', task);
    
    // Try to start the task immediately if we have capacity
    this.processQueue();
    
    return taskId;
  }

  // Process the task queue
  private async processQueue(): Promise<void> {
    while (
      this.taskQueue.length > 0 && 
      this.runningTasks.size < this.config.maxConcurrentTasks
    ) {
      const task = this.taskQueue.shift();
      if (!task) break;

      task.status = 'running';
      this.loadingState.activeTasks.set(task.id, task);
      
      this.emit('taskStarted', task);
      
      const taskPromise = this.executeTask(task);
      this.runningTasks.set(task.id, taskPromise);

      taskPromise
        .then(() => this.completeTask(task.id, 'completed'))
        .catch((error) => this.completeTask(task.id, 'failed', error))
        .finally(() => {
          this.runningTasks.delete(task.id);
          this.processQueue(); // Try to start next task
        });
    }

    this.updateLoadingState();
  }

  // Execute a specific task
  private async executeTask(task: LoadingTask): Promise<any> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout);
    });

    const taskExecution = this.performTaskExecution(task);

    return Promise.race([taskExecution, timeout]);
  }

  // Perform the actual task execution based on type
  private async performTaskExecution(task: LoadingTask): Promise<any> {
    switch (task.type) {
      case 'content':
        return this.loadCardContent(task);
      case 'section':
        return this.loadSectionContent(task);
      case 'asset':
        return this.loadAssetContent(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  // Load full card content
  private async loadCardContent(task: LoadingTask): Promise<CardContent> {
    // Update progress incrementally
    const updateProgress = (progress: number) => {
      task.progress = Math.min(progress, 100);
      this.emit('taskProgress', task);
    };

    updateProgress(20);
    
    // Simulate progressive loading with placeholders
    if (this.config.enablePlaceholders) {
      const placeholder = await this.generatePlaceholderContent(task.cardId);
      updateProgress(40);
      this.emit('placeholderGenerated', { task, placeholder });
    }

    updateProgress(60);
    
    // This would typically call a content provider
    // For now, we'll simulate the loading process
    await this.simulateAsyncOperation(task.estimatedDuration || 2000);
    
    updateProgress(80);
    
    // Generate final content
    const content: CardContent = {
      id: task.cardId,
      title: `Content for ${task.cardId}`,
      sections: [],
      metadata: task.metadata || {},
      createdAt: new Date(),
      lastModified: new Date()
    };

    updateProgress(100);
    
    return content;
  }

  // Load individual section content
  private async loadSectionContent(task: LoadingTask): Promise<CardSection> {
    const updateProgress = (progress: number) => {
      task.progress = Math.min(progress, 100);
      this.emit('taskProgress', task);
    };

    updateProgress(30);
    
    if (this.config.enablePlaceholders && task.sectionIndex !== undefined) {
      const placeholder = this.config.placeholderProvider.generatePlaceholder(
        task.cardId,
        task.sectionIndex
      );
      updateProgress(50);
      this.emit('sectionPlaceholder', { task, placeholder });
    }

    updateProgress(70);
    
    await this.simulateAsyncOperation(task.estimatedDuration || 1000);
    
    const section: CardSection = {
      type: 'text',
      content: `Section content for ${task.cardId}:${task.sectionIndex}`,
      metadata: task.metadata || {}
    };

    updateProgress(100);
    
    return section;
  }

  // Load asset content (images, etc.)
  private async loadAssetContent(task: LoadingTask): Promise<any> {
    const updateProgress = (progress: number) => {
      task.progress = Math.min(progress, 100);
      this.emit('taskProgress', task);
    };

    updateProgress(25);
    await this.simulateAsyncOperation(500);
    
    updateProgress(50);
    await this.simulateAsyncOperation(500);
    
    updateProgress(75);
    await this.simulateAsyncOperation(500);
    
    updateProgress(100);
    
    return { url: `asset-${task.cardId}`, type: 'image' };
  }

  // Generate placeholder content for a card
  private async generatePlaceholderContent(cardId: string): Promise<CardContent> {
    if (!this.config.placeholderProvider) {
      throw new Error('No placeholder provider configured');
    }

    const placeholderSection = this.config.placeholderProvider.generatePlaceholder(cardId, 0);
    
    return {
      id: `${cardId}-placeholder`,
      title: 'Loading...',
      sections: [placeholderSection],
      metadata: { isPlaceholder: true },
      createdAt: new Date(),
      lastModified: new Date()
    };
  }

  // Complete a task
  private completeTask(taskId: string, status: 'completed' | 'failed', error?: Error): void {
    const task = this.loadingState.activeTasks.get(taskId);
    if (!task) return;

    task.status = status;
    task.error = error;
    task.progress = status === 'completed' ? 100 : task.progress;

    if (status === 'completed') {
      this.loadingState.completedTasks++;
      this.emit('taskCompleted', task);
    } else {
      this.emit('taskFailed', task, error);
    }

    this.loadingState.activeTasks.delete(taskId);
    this.updateLoadingState();
  }

  // Sort task queue by priority
  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => b.priority - a.priority);
  }

  // Update loading state
  private updateLoadingState(): void {
    const activeTasks = Array.from(this.loadingState.activeTasks.values());
    const totalTasks = this.loadingState.completedTasks + activeTasks.length + this.taskQueue.length;
    
    this.loadingState.totalTasks = totalTasks;
    this.loadingState.isLoading = activeTasks.length > 0 || this.taskQueue.length > 0;
    
    if (totalTasks > 0) {
      const completed = this.loadingState.completedTasks;
      const inProgress = activeTasks.reduce((sum, task) => sum + task.progress, 0) / 100;
      this.loadingState.overallProgress = ((completed + inProgress) / totalTasks) * 100;
    } else {
      this.loadingState.overallProgress = 100;
    }

    // Calculate estimated time remaining
    if (this.loadingState.isLoading) {
      const avgDuration = this.calculateAverageTaskDuration();
      const remainingTasks = this.taskQueue.length + 
        Array.from(this.loadingState.activeTasks.values())
          .reduce((sum, task) => sum + (100 - task.progress) / 100, 0);
      
      this.loadingState.estimatedTimeRemaining = remainingTasks * avgDuration;
    } else {
      this.loadingState.estimatedTimeRemaining = undefined;
    }

    this.emit('loadingStateUpdated', this.loadingState);
  }

  // Calculate average task duration for estimates
  private calculateAverageTaskDuration(): number {
    // This would be based on historical data
    // For now, return a default estimate
    return 2000; // 2 seconds
  }

  // Start progress tracking
  private startProgressTracking(): void {
    this.progressTimer = setInterval(() => {
      if (this.loadingState.isLoading) {
        this.updateLoadingState();
      }
    }, this.config.progressUpdateInterval);
  }

  // Stop progress tracking
  private stopProgressTracking(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  // Simulate async operation
  private async simulateAsyncOperation(duration: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, duration));
  }

  // Public methods
  getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }

  getTaskProgress(taskId: string): number {
    const task = this.loadingState.activeTasks.get(taskId);
    return task ? task.progress : 0;
  }

  cancelTask(taskId: string): boolean {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex >= 0) {
      this.taskQueue.splice(queueIndex, 1);
      this.emit('taskCancelled', taskId);
      return true;
    }

    // Cancel running task
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      // We can't actually cancel the promise, but we can mark it as cancelled
      this.completeTask(taskId, 'failed', new Error('Task cancelled'));
      return true;
    }

    return false;
  }

  cancelAllTasks(): void {
    // Cancel queued tasks
    const queuedTasks = [...this.taskQueue];
    this.taskQueue = [];
    
    // Cancel active tasks
    const activeTasks = Array.from(this.loadingState.activeTasks.keys());
    
    queuedTasks.forEach(task => this.emit('taskCancelled', task.id));
    activeTasks.forEach(taskId => this.cancelTask(taskId));
    
    this.updateLoadingState();
  }

  pause(): void {
    // Implementation for pausing loading operations
    this.emit('loadingPaused');
  }

  resume(): void {
    // Implementation for resuming loading operations
    this.processQueue();
    this.emit('loadingResumed');
  }

  destroy(): void {
    this.cancelAllTasks();
    this.stopProgressTracking();
    this.removeAllListeners();
  }

  // Configuration updates
  updateConfig(newConfig: Partial<LoadingServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  // Statistics
  getStatistics() {
    return {
      totalTasksProcessed: this.loadingState.completedTasks,
      currentlyLoading: this.loadingState.activeTasks.size,
      queuedTasks: this.taskQueue.length,
      overallProgress: this.loadingState.overallProgress,
      isLoading: this.loadingState.isLoading,
      estimatedTimeRemaining: this.loadingState.estimatedTimeRemaining
    };
  }
}

export default GenericLoadingService;