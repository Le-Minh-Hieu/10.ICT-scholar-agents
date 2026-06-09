import { InputMap, CaptureStatus } from './storage-service.js';
import { PRIMARY_SYMBOLS, MACRO_ASSETS, REQUIRED_TIMEFRAMES } from '../config/assets.js';

export class ValidationService {
  static validateInput(inputMap: InputMap): CaptureStatus {
    const assets = Object.keys(inputMap);
    
    const has_primary = PRIMARY_SYMBOLS.some(symbol => assets.includes(symbol));
    const has_macro = MACRO_ASSETS.every(asset => assets.includes(asset));
    
    // Check for LTF on at least one primary symbol
    const primarySymbolsInInput = PRIMARY_SYMBOLS.filter(s => assets.includes(s));
    const has_ltf = primarySymbolsInInput.some(s => 
      inputMap[s].includes('1m') || inputMap[s].includes('5m') || inputMap[s].includes('15m')
    );

    const missing: string[] = [];
    
    // Check for missing macro assets
    MACRO_ASSETS.forEach(asset => {
      if (!assets.includes(asset)) {
        missing.push(asset);
      }
    });

    // Check for missing timeframes on primary symbols
    primarySymbolsInInput.forEach(symbol => {
      REQUIRED_TIMEFRAMES.PRIMARY.forEach(tf => {
        if (!inputMap[symbol].includes(tf)) {
          missing.push(`${symbol}:${tf}`);
        }
      });
    });

    return {
      input_complete: missing.length === 0,
      analysis_complete: false,
      has_primary,
      has_macro,
      has_ltf,
      missing
    };
  }
}
