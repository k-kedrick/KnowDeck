package middleware

import (
	"net/http"
	"sync"
	"time"

	"knowledge-base/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ipLimiter struct {
	timestamps []time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	limits   map[string]*ipLimiter
	maxReqs  int
	duration time.Duration
}

func NewRateLimiter(maxReqs int, duration time.Duration) *RateLimiter {
	rl := &RateLimiter{
		limits:   make(map[string]*ipLimiter),
		maxReqs:  maxReqs,
		duration: duration,
	}

	// 自动定期清理过期记录
	go func() {
		ticker := time.NewTicker(duration * 2)
		for range ticker.C {
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for ip, lim := range rl.limits {
		validIndex := 0
		for _, t := range lim.timestamps {
			if now.Sub(t) <= rl.duration {
				break
			}
			validIndex++
		}
		if validIndex >= len(lim.timestamps) {
			delete(rl.limits, ip)
		} else {
			lim.timestamps = lim.timestamps[validIndex:]
		}
	}
}

func (rl *RateLimiter) Middleware(errMsg string) gin.HandlerFunc {
	if errMsg == "" {
		errMsg = "请求过于频繁，请稍后再试"
	}

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		rl.mu.Lock()
		lim, exists := rl.limits[ip]
		if !exists {
			lim = &ipLimiter{timestamps: make([]time.Time, 0, rl.maxReqs)}
			rl.limits[ip] = lim
		}

		// 清理该 IP 的历史过期时间戳
		cutoff := now.Add(-rl.duration)
		filtered := lim.timestamps[:0]
		for _, t := range lim.timestamps {
			if t.After(cutoff) {
				filtered = append(filtered, t)
			}
		}
		lim.timestamps = filtered

		if len(lim.timestamps) >= rl.maxReqs {
			rl.mu.Unlock()
			response.Error(c, http.StatusTooManyRequests, 429, errMsg)
			c.Abort()
			return
		}

		lim.timestamps = append(lim.timestamps, now)
		rl.mu.Unlock()

		c.Next()
	}
}
