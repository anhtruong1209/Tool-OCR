/**
 * Track API usage and costs for monitoring
 */

interface ApiCall {
  timestamp: number;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

class ApiUsageTracker {
  private calls: ApiCall[] = [];
  // Gemini 2.5 Flash Free Tier limits (from official docs)
  private dailyLimit = 250; // Requests per day (RPD)
  private rpmLimit = 10; // Requests per minute (RPM)
  private tpmLimit = 250000; // Tokens per minute (TPM) - input
  private costPerInputToken = 0.075 / 1_000_000; // $0.075 per 1M tokens
  private costPerOutputToken = 0.30 / 1_000_000; // $0.30 per 1M tokens

  /**
   * Track an API call
   */
  trackCall(model: string, inputTokens?: number, outputTokens?: number): void {
    const cost = this.calculateCost(inputTokens || 0, outputTokens || 0);
    this.calls.push({
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      cost,
    });

    // Keep only last 1000 calls in memory
    if (this.calls.length > 1000) {
      this.calls = this.calls.slice(-1000);
    }

    // Log warning if approaching daily limit
    const todayCalls = this.getTodayCallCount();
    if (todayCalls >= this.dailyLimit * 0.9) {
      console.warn(`[API Tracker] ⚠️ Approaching daily limit: ${todayCalls}/${this.dailyLimit} calls`);
    }
  }

  /**
   * Calculate cost based on tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * this.costPerInputToken) + (outputTokens * this.costPerOutputToken);
  }

  /**
   * Get call count for today
   */
  getTodayCallCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return this.calls.filter(call => call.timestamp >= todayTimestamp).length;
  }

  /**
   * Get total cost for today
   */
  getTodayCost(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return this.calls
      .filter(call => call.timestamp >= todayTimestamp)
      .reduce((sum, call) => sum + (call.cost || 0), 0);
  }

  /**
   * Get total cost for this month
   */
  getMonthCost(): number {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const monthTimestamp = firstDayOfMonth.getTime();

    return this.calls
      .filter(call => call.timestamp >= monthTimestamp)
      .reduce((sum, call) => sum + (call.cost || 0), 0);
  }

  /**
   * Get requests per minute in the last minute
   */
  getCurrentRPM(): number {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    return this.calls.filter(call => call.timestamp >= oneMinuteAgo).length;
  }

  /**
   * Check if we're approaching rate limits
   */
  checkRateLimits(): {
    approachingDailyLimit: boolean;
    approachingRPMLimit: boolean;
    canMakeRequest: boolean;
  } {
    const todayCalls = this.getTodayCallCount();
    const currentRPM = this.getCurrentRPM();
    
    return {
      approachingDailyLimit: todayCalls >= this.dailyLimit * 0.9,
      approachingRPMLimit: currentRPM >= this.rpmLimit * 0.9,
      canMakeRequest: todayCalls < this.dailyLimit && currentRPM < this.rpmLimit,
    };
  }

  /**
   * Get usage statistics
   */
  getStats(): {
    todayCalls: number;
    todayCost: number;
    monthCost: number;
    dailyLimit: number;
    remainingCalls: number;
    currentRPM: number;
    rpmLimit: number;
  } {
    const todayCalls = this.getTodayCallCount();
    const todayCost = this.getTodayCost();
    const monthCost = this.getMonthCost();
    const currentRPM = this.getCurrentRPM();

    return {
      todayCalls,
      todayCost,
      monthCost,
      dailyLimit: this.dailyLimit,
      remainingCalls: Math.max(0, this.dailyLimit - todayCalls),
      currentRPM,
      rpmLimit: this.rpmLimit,
    };
  }

  /**
   * Log usage summary
   */
  logSummary(): void {
    const stats = this.getStats();
    const rateLimits = this.checkRateLimits();
    
    console.log(`[API Tracker] 📊 Usage Summary:
  Today: ${stats.todayCalls}/${stats.dailyLimit} calls ($${stats.todayCost.toFixed(4)})
  Current: ${stats.currentRPM}/${stats.rpmLimit} RPM
  This Month: $${stats.monthCost.toFixed(4)}
  Remaining: ${stats.remainingCalls} calls today`);
    
    if (rateLimits.approachingDailyLimit) {
      console.warn(`[API Tracker] ⚠️ Approaching daily limit: ${stats.todayCalls}/${stats.dailyLimit}`);
    }
    if (rateLimits.approachingRPMLimit) {
      console.warn(`[API Tracker] ⚠️ Approaching RPM limit: ${stats.currentRPM}/${stats.rpmLimit}`);
    }
    if (!rateLimits.canMakeRequest) {
      console.error(`[API Tracker] ❌ Rate limit reached! Cannot make more requests.`);
    }
  }
}

// Export singleton instance
export const apiUsageTracker = new ApiUsageTracker();

