/**
 * PINN Simulation Queue System using BullMQ and Redis
 * Manages long-running GPU-intensive PINN simulations
 * Prevents HTTP timeouts and enables real-time progress tracking
 * Ready for integration into FastAPI backend
 */

import { Queue, Worker, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { EventEmitter } from 'events'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PINNSimulationJob {
  projectId: string
  analysisId: string
  simulationType: 'training' | 'inference' | 'assimilation'
  modelConfig: {
    layers: number[]
    fluidType: 'H2' | 'NH3' | 'CH4' | 'sCO2'
    epochs?: number
    learningRate?: number
    batchSize?: number
  }
  dataPoints?: {
    time: number
    x: number
    y: number
    z: number
  }[]
  metadata?: Record<string, any>
}

export interface PINNJobProgress {
  jobId: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress: number
  currentEpoch?: number
  totalEpochs?: number
  currentLoss?: number
  estimatedTimeRemaining?: number
  timestamp: string
}

export interface PINNJobResult {
  jobId: string
  projectId: string
  analysisId: string
  status: 'success' | 'failure'
  result?: {
    modelPath: string
    finalLoss: number
    predictions?: any[]
    credibilityScore?: number
  }
  error?: string
  executionTime: number
  timestamp: string
}

// ============================================================================
// PINN Queue Manager
// ============================================================================

export class PINNQueueManager extends EventEmitter {
  private redis: Redis
  private queue: Queue<PINNSimulationJob>
  private worker: Worker<PINNSimulationJob>
  private queueEvents: QueueEvents
  private progressMap: Map<string, PINNJobProgress> = new Map()

  constructor(
    redisUrl: string = 'redis://localhost:6379',
    queueName: string = 'pinn-simulations'
  ) {
    super()

    this.redis = new Redis(redisUrl)
    
    const connection = new Redis(redisUrl)
    this.queue = new Queue(queueName, { connection })
    
    this.queueEvents = new QueueEvents(queueName, { connection })
    
    this.worker = new Worker(queueName, this.processJob.bind(this), {
      connection,
      concurrency: 1, // One GPU-intensive job at a time
    })

    this.setupEventListeners()
  }

  /**
   * Setup event listeners for queue and worker
   */
  private setupEventListeners(): void {
    // Worker events
    this.worker.on('completed', (job) => {
      console.log(`[COMPLETED] Job ${job.id}: ${job.data.simulationType}`)
      this.emit('job:completed', job.id)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`[FAILED] Job ${job?.id}: ${err.message}`)
      this.emit('job:failed', job?.id, err)
    })

    this.worker.on('progress', (job, progress) => {
      console.log(`[PROGRESS] Job ${job.id}: ${progress}%`)
      this.updateProgress(job.id, progress)
      this.emit('job:progress', job.id, progress)
    })

    // Queue events
    this.queueEvents.on('added', ({ jobId }) => {
      console.log(`[ADDED] Job ${jobId} added to queue`)
      this.emit('job:added', jobId)
    })

    this.queueEvents.on('active', ({ jobId }) => {
      console.log(`[ACTIVE] Job ${jobId} started processing`)
      this.emit('job:active', jobId)
    })
  }

  /**
   * Submit a new PINN simulation job to the queue
   */
  async submitJob(job: PINNSimulationJob): Promise<string> {
    try {
      const queueJob = await this.queue.add(
        `${job.simulationType}-${job.projectId}`,
        job,
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
          },
          removeOnFail: false, // Keep failed jobs for debugging
        }
      )

      console.log(`[SUBMIT] Job ${queueJob.id} submitted for ${job.simulationType}`)
      
      // Initialize progress tracking
      this.progressMap.set(queueJob.id, {
        jobId: queueJob.id,
        status: 'pending',
        progress: 0,
        timestamp: new Date().toISOString(),
      })

      return queueJob.id
    } catch (error) {
      console.error('Error submitting job:', error)
      throw error
    }
  }

  /**
   * Get job progress
   */
  async getJobProgress(jobId: string): Promise<PINNJobProgress | null> {
    try {
      const job = await this.queue.getJob(jobId)
      if (!job) return this.progressMap.get(jobId) || null

      const state = await job.getState()
      const progress = job.progress() as number

      const progressData: PINNJobProgress = {
        jobId,
        status: state as any,
        progress,
        timestamp: new Date().toISOString(),
      }

      // Add job-specific data if available
      if (job.data.modelConfig.epochs) {
        const currentEpoch = Math.floor((progress / 100) * job.data.modelConfig.epochs)
        progressData.currentEpoch = currentEpoch
        progressData.totalEpochs = job.data.modelConfig.epochs
      }

      return progressData
    } catch (error) {
      console.error('Error getting job progress:', error)
      return null
    }
  }

  /**
   * Get job result
   */
  async getJobResult(jobId: string): Promise<PINNJobResult | null> {
    try {
      const job = await this.queue.getJob(jobId)
      if (!job) return null

      const state = await job.getState()
      
      if (state === 'completed') {
        const result = job.returnvalue as any
        return {
          jobId,
          projectId: job.data.projectId,
          analysisId: job.data.analysisId,
          status: 'success',
          result,
          executionTime: job.finishedOn! - job.processedOn!,
          timestamp: new Date().toISOString(),
        }
      } else if (state === 'failed') {
        return {
          jobId,
          projectId: job.data.projectId,
          analysisId: job.data.analysisId,
          status: 'failure',
          error: job.failedReason,
          executionTime: job.finishedOn! - job.processedOn!,
          timestamp: new Date().toISOString(),
        }
      }

      return null
    } catch (error) {
      console.error('Error getting job result:', error)
      return null
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId)
      if (!job) return false

      await job.remove()
      console.log(`[CANCELLED] Job ${jobId}`)
      return true
    } catch (error) {
      console.error('Error cancelling job:', error)
      return false
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }> {
    try {
      const counts = await this.queue.getJobCounts()
      return counts
    } catch (error) {
      console.error('Error getting queue stats:', error)
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    }
  }

  /**
   * Process a PINN simulation job
   * This is called by the worker
   */
  private async processJob(job: any): Promise<any> {
    const startTime = Date.now()
    const { projectId, analysisId, simulationType, modelConfig, dataPoints } = job.data

    try {
      console.log(`[PROCESSING] Job ${job.id}: ${simulationType}`)

      // Simulate job progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await job.progress(i)
      }

      // Call actual PINN backend API
      const result = await this.callPINNBackend(
        simulationType,
        modelConfig,
        dataPoints
      )

      const executionTime = Date.now() - startTime
      console.log(`[RESULT] Job ${job.id} completed in ${executionTime}ms`)

      return {
        modelPath: result.modelPath,
        finalLoss: result.finalLoss,
        predictions: result.predictions,
        credibilityScore: result.credibilityScore,
        executionTime,
      }
    } catch (error) {
      console.error(`[ERROR] Job ${job.id}:`, error)
      throw error
    }
  }

  /**
   * Call PINN backend API
   */
  private async callPINNBackend(
    simulationType: string,
    modelConfig: any,
    dataPoints?: any[]
  ): Promise<any> {
    const apiUrl = process.env.H2_INFERENCE_API_URL || 'https://quantum-hybrid-pinn-jdoj.onrender.com'

    let endpoint = ''
    let payload = {}

    switch (simulationType) {
      case 'training':
        endpoint = '/v2/model/train'
        payload = {
          N_pde: 5000,
          epochs: modelConfig.epochs || 5000,
          learning_rate: modelConfig.learningRate || 0.001,
          model_name: `pinn_${Date.now()}`,
        }
        break

      case 'inference':
        endpoint = '/v2/validate-3d'
        if (dataPoints && dataPoints.length > 0) {
          payload = dataPoints[0]
        }
        break

      case 'assimilation':
        endpoint = '/v2/assimilate'
        payload = {
          current_state: [70, 0.1, 0.1, 0.1, 20],
          observation: [1e6, 20, 0.1],
        }
        break
    }

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Update progress in memory
   */
  private updateProgress(jobId: string, progress: number): void {
    const current = this.progressMap.get(jobId)
    if (current) {
      current.progress = progress
      current.timestamp = new Date().toISOString()
    }
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.worker.close()
    await this.queueEvents.close()
    await this.queue.close()
    await this.redis.quit()
  }
}

// ============================================================================
// Express/FastAPI Integration Helper
// ============================================================================

export class PINNQueueAPI {
  constructor(private manager: PINNQueueManager) {}

  /**
   * Express route handler for submitting jobs
   */
  async submitSimulation(req: any, res: any): Promise<void> {
    try {
      const job = req.body as PINNSimulationJob
      const jobId = await this.manager.submitJob(job)
      
      res.json({
        status: 'success',
        jobId,
        statusUrl: `/api/pinn/jobs/${jobId}`,
      })
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Express route handler for getting job status
   */
  async getJobStatus(req: any, res: any): Promise<void> {
    try {
      const { jobId } = req.params
      const progress = await this.manager.getJobProgress(jobId)
      
      if (!progress) {
        return res.status(404).json({
          status: 'error',
          error: 'Job not found',
        })
      }

      res.json({
        status: 'success',
        data: progress,
      })
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Express route handler for getting job result
   */
  async getJobResult(req: any, res: any): Promise<void> {
    try {
      const { jobId } = req.params
      const result = await this.manager.getJobResult(jobId)
      
      if (!result) {
        return res.status(404).json({
          status: 'error',
          error: 'Job not found or still processing',
        })
      }

      res.json({
        status: 'success',
        data: result,
      })
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Express route handler for queue statistics
   */
  async getQueueStats(req: any, res: any): Promise<void> {
    try {
      const stats = await this.manager.getQueueStats()
      res.json({
        status: 'success',
        data: stats,
      })
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

// ============================================================================
// Usage Example
// ============================================================================

/*
import express from 'express'

const app = express()
app.use(express.json())

const manager = new PINNQueueManager('redis://localhost:6379')
const api = new PINNQueueAPI(manager)

// Routes
app.post('/api/pinn/jobs', (req, res) => api.submitSimulation(req, res))
app.get('/api/pinn/jobs/:jobId', (req, res) => api.getJobStatus(req, res))
app.get('/api/pinn/jobs/:jobId/result', (req, res) => api.getJobResult(req, res))
app.get('/api/pinn/stats', (req, res) => api.getQueueStats(req, res))

// Event listeners
manager.on('job:completed', (jobId) => {
  console.log(`Job ${jobId} completed - notify user`)
})

manager.on('job:failed', (jobId, error) => {
  console.log(`Job ${jobId} failed - notify user with error`)
})

app.listen(3000, () => {
  console.log('PINN Queue API running on port 3000')
})

process.on('SIGINT', async () => {
  await manager.close()
  process.exit(0)
})
*/
