const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * POST /api/vision/multi-tf
 * Receive batch of images for multiple symbols and timeframes
 */
router.post('/multi-tf', async (req, res) => {
    const { session_id, data } = req.body;

    if (!session_id || !data) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    try {
      let totalSaved = 0;
      // Requirement: data/sessions/{id}-DayOfWeek/input/{symbol}/{tf}.jpg

      // Convert session_id (e.g., "2026-05-02") to Date object to get the day of the week
      const date = new Date(session_id);
      const options = { weekday: 'long' };
      const dayOfWeek = new Intl.DateTimeFormat('en-US', options).format(date);
      const sessionDirName = `${session_id}-${dayOfWeek}`;

      const sessionDir = path.join(__dirname, '../../data/sessions', sessionDirName);
    const inputDir = path.join(sessionDir, 'input');

    for (const symbol in data) {
      const normalizedSymbol = symbol.toUpperCase();
      const symbolDir = path.join(inputDir, normalizedSymbol);
      
      // Ensure directory exists for each symbol
      if (!fs.existsSync(symbolDir)) {
        fs.mkdirSync(symbolDir, { recursive: true });
      }

      const images = data[symbol];
      for (const item of images) {
        const { timeframe, image } = item;
        if (!timeframe || !image) continue;

        // image is "data:image/jpeg;base64,..."
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        const fileName = `${timeframe}.jpg`;
        const filePath = path.join(symbolDir, fileName);
        
        fs.writeFileSync(filePath, buffer);
        
        // Mandatory Logging
        console.log(JSON.stringify({
          level: "INFO",
          stage: "STORAGE_WRITE",
          message: `Saved image for ${normalizedSymbol} @ ${timeframe}`,
          data: {
            symbol: normalizedSymbol,
            tf: timeframe,
            path: filePath,
            size: buffer.length
          }
        }));

        totalSaved++;
      }
    }

    console.log(`[Server] Session ${session_id} complete. Saved ${totalSaved} images.`);

    res.json({
      success: true,
      session_id,
      count: totalSaved
    });
  } catch (error) {
    console.error('[Server] Error saving session data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
