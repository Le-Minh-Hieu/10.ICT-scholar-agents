/**
 * TradingView Main World Bridge script
 * Runs directly in the TradingView page context (world: 'MAIN') to access window.chartWidgetCollection.
 */
(function() {
  if (window.TV_BRIDGE_ACTIVE) {
    console.log("[Bridge] already active in main world");
    return;
  }
  window.TV_BRIDGE_ACTIVE = true;
  console.log("[Bridge] injected successfully in main world");

  function getWidgetCollection() {
    if (typeof window.chartWidgetCollection !== 'undefined') {
      return window.chartWidgetCollection;
    }
    try {
      if (window.parent && typeof window.parent.chartWidgetCollection !== 'undefined') {
        return window.parent.chartWidgetCollection;
      }
    } catch (e) {}
    try {
      if (window.top && typeof window.top.chartWidgetCollection !== 'undefined') {
        return window.top.chartWidgetCollection;
      }
    } catch (e) {}
    return undefined;
  }

  // Audited candidates from TV object discovery
  function getActiveWidget(widgetCollection) {
    if (!widgetCollection) return null;
    
    // Candidate 1: activeChartWidget() function call
    if (typeof widgetCollection.activeChartWidget === 'function') {
      try {
        const val = widgetCollection.activeChartWidget();
        if (val) return val;
      } catch (e) {}
    }
    
    // Candidate 2: activeChartWidget.value() function call
    if (widgetCollection.activeChartWidget && typeof widgetCollection.activeChartWidget.value === 'function') {
      try {
        const val = widgetCollection.activeChartWidget.value();
        if (val) return val;
      } catch (e) {}
    }

    // Candidate 3: _activeChartWidget property or function (TV internal key fallback)
    if (typeof widgetCollection._activeChartWidget === 'function') {
      try {
        const val = widgetCollection._activeChartWidget();
        if (val) return val;
      } catch (e) {}
    }
    if (widgetCollection._activeChartWidget) {
      return widgetCollection._activeChartWidget;
    }

    // Candidate 4: chartWidgets array or function
    if (typeof widgetCollection.chartWidgets === 'function') {
      try {
        const list = widgetCollection.chartWidgets();
        if (list && list.length > 0) return list[0];
      } catch (e) {}
    }
    if (Array.isArray(widgetCollection.chartWidgets) && widgetCollection.chartWidgets.length > 0) {
      return widgetCollection.chartWidgets[0];
    }
    
    return null;
  }

  function getDiagnostics() {
    const widgetCollection = getWidgetCollection();
    const activeWidgetVal = getActiveWidget(widgetCollection);
    const model = (activeWidgetVal && typeof activeWidgetVal.model === 'function') ? activeWidgetVal.model() : null;
    const mainSeries = (model && typeof model.mainSeries === 'function') ? model.mainSeries() : null;

    return {
      locationHref: window.location.href,
      chartWidgetCollectionType: typeof widgetCollection,
      chartWidgetCollectionKeys: (widgetCollection && typeof widgetCollection === 'object') ? Object.keys(widgetCollection) : [],
      activeChartWidgetType: widgetCollection ? typeof widgetCollection.activeChartWidget : 'undefined',
      activeChartWidgetExists: widgetCollection ? typeof widgetCollection.activeChartWidget !== 'undefined' : false,
      activeChartWidgetValueExists: (widgetCollection && widgetCollection.activeChartWidget) ? typeof widgetCollection.activeChartWidget.value !== 'undefined' : false,
      windowTVBridgeActive: !!window.TV_BRIDGE_ACTIVE,
      chartWidgetCollectionExists: typeof widgetCollection !== 'undefined',
      activeWidgetExists: !!activeWidgetVal,
      modelExists: !!model,
      mainSeriesExists: !!mainSeries
    };
  }

  function sendDiagnostics(actionName, errorString = null) {
    const diag = getDiagnostics();
    console.log(`[Bridge Diagnostics] ${actionName} error=${errorString}`, diag);
    window.postMessage({
      action: "TV_BRIDGE_DIAGNOVICS", // typo-safe diagnostics matching request
      actionFallback: "TV_BRIDGE_DIAGNOSTICS",
      bridgeAction: actionName,
      error: errorString,
      diagnostics: diag
    }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.data && event.data.action === "CHANGE_SYMBOL_AND_RESOLUTION") {
      const { symbol, resolution } = event.data;
      let attempts = 0;
      const maxAttempts = 10; // 5 seconds total

      function collectDetailedDiagnostics() {
        const diag = {
          locationHref: window.location.href,
          chartWidgetCollectionExists: typeof window.chartWidgetCollection !== 'undefined',
          chartWidgetCollectionType: typeof window.chartWidgetCollection,
          widgetsCount: 0,
          activeChartExists: false,
          chartExists: false,
          modelExists: false,
          setSymbolExists: false,
          setResolutionExists: false,
          setSymbolAndResolutionExists: false,
          iframeCount: 0,
          iframes: []
        };

        try {
          const col = getWidgetCollection();
          if (col) {
            diag.chartWidgetCollectionExists = true;
            diag.chartWidgetCollectionType = typeof col;

            const activeWidget = getActiveWidget(col);
            if (activeWidget) {
              diag.activeWidgetExists = true;
              diag.activeChartExists = typeof activeWidget.activeChart === 'function' || typeof activeWidget.activeChart !== 'undefined';
              diag.chartExists = typeof activeWidget.chart === 'function' || typeof activeWidget.chart !== 'undefined';
              
              const model = typeof activeWidget.model === 'function' ? activeWidget.model() : null;
              diag.modelExists = !!model;

              diag.setSymbolExists = typeof activeWidget.setSymbol === 'function';
              diag.setResolutionExists = typeof activeWidget.setResolution === 'function';
              
              if (model) {
                diag.setSymbolAndResolutionExists = typeof model.setSymbolAndResolution === 'function';
              }
            }

            if (typeof col.chartWidgets === 'function') {
              const list = col.chartWidgets();
              diag.widgetsCount = list ? list.length : 0;
            } else if (Array.isArray(col.chartWidgets)) {
              diag.widgetsCount = col.chartWidgets.length;
            }
          }
        } catch (e) {
          diag.probeError = e.message;
        }

        try {
          const iframesList = document.querySelectorAll('iframe');
          diag.iframeCount = iframesList.length;
          
          iframesList.forEach((iframe, idx) => {
            const iframeDiag = {
              index: idx,
              src: iframe.src || '',
              isSameOrigin: false,
              locationHref: null,
              chartWidgetCollectionExists: false,
              widgetsCount: 0
            };

            try {
              const iframeWin = iframe.contentWindow;
              if (iframeWin) {
                iframeDiag.locationHref = iframeWin.location.href;
                iframeDiag.isSameOrigin = true;
                iframeDiag.chartWidgetCollectionExists = typeof iframeWin.chartWidgetCollection !== 'undefined';
                
                const col = iframeWin.chartWidgetCollection;
                if (col) {
                  if (typeof col.chartWidgets === 'function') {
                    const list = col.chartWidgets();
                    iframeDiag.widgetsCount = list ? list.length : 0;
                  } else if (Array.isArray(col.chartWidgets)) {
                    iframeDiag.widgetsCount = col.chartWidgets.length;
                  }
                }
              }
            } catch (err) {
              iframeDiag.accessError = err.message;
            }

            diag.iframes.push(iframeDiag);
          });
        } catch (e) {
          diag.iframeEnumError = e.message;
        }

        return diag;
      }

      function tryChangeSymbolAndResolution() {
        try {
          const widgetCollection = getWidgetCollection();
          const activeWidgetVal = getActiveWidget(widgetCollection);
          
          if (typeof widgetCollection === 'undefined' || !activeWidgetVal) {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(tryChangeSymbolAndResolution, 500);
              return;
            }
            sendDiagnostics("CHANGE_SYMBOL_AND_RESOLUTION", typeof widgetCollection === 'undefined' ? "WIDGET_UNAVAILABLE" : "NO_ACTIVE_WIDGET");
            window.postMessage({
              action: "CHANGE_SYMBOL_AND_RESOLUTION_RESPONSE",
              success: false,
              error: typeof widgetCollection === 'undefined' ? "WIDGET_UNAVAILABLE" : "NO_ACTIVE_WIDGET",
              diagnostics: collectDetailedDiagnostics()
            }, "*");
            return;
          }

          let success = false;
          let lastError = null;

          const candidates = [
            () => {
              const model = typeof activeWidgetVal.model === 'function' ? activeWidgetVal.model() : null;
              if (model && typeof model.setSymbolAndResolution === 'function') {
                model.setSymbolAndResolution(symbol, resolution);
                return true;
              }
              return false;
            },
            () => {
              if (typeof activeWidgetVal.setSymbol === 'function' && typeof activeWidgetVal.setResolution === 'function') {
                activeWidgetVal.setSymbol(symbol);
                activeWidgetVal.setResolution(resolution);
                return true;
              }
              return false;
            },
            () => {
              if (typeof activeWidgetVal.chart === 'function') {
                const chart = activeWidgetVal.chart();
                if (chart && typeof chart.setSymbol === 'function' && typeof chart.setResolution === 'function') {
                  chart.setSymbol(symbol);
                  chart.setResolution(resolution);
                  return true;
                }
              }
              return false;
            },
            () => {
              const model = typeof activeWidgetVal.model === 'function' ? activeWidgetVal.model() : null;
              if (model && typeof model.mainSeries === 'function') {
                const series = model.mainSeries();
                if (series && typeof series.setSymbol === 'function' && typeof series.setResolution === 'function') {
                  series.setSymbol(symbol);
                  series.setResolution(resolution);
                  return true;
                }
              }
              return false;
            }
          ];

          for (const runCandidate of candidates) {
            try {
              if (runCandidate()) {
                success = true;
                break;
              }
            } catch (e) {
              lastError = e;
            }
          }

          if (!success) {
            throw new Error("No client-side symbol change methods succeeded. Last error: " + (lastError ? lastError.message : "Not supported"));
          }

          try {
            const url = new URL(window.location.href);
            url.searchParams.set('symbol', symbol);
            url.searchParams.set('interval', resolution);
            window.history.pushState({}, '', url.toString());
          } catch (e) {}

          window.postMessage({
            action: "CHANGE_SYMBOL_AND_RESOLUTION_RESPONSE",
            success: true,
            error: null,
            diagnostics: collectDetailedDiagnostics()
          }, "*");
        } catch (err) {
          sendDiagnostics("CHANGE_SYMBOL_AND_RESOLUTION_ERROR", err.message);
          window.postMessage({
            action: "CHANGE_SYMBOL_AND_RESOLUTION_RESPONSE",
            success: false,
            error: err.message,
            diagnostics: collectDetailedDiagnostics()
          }, "*");
        }
      }

      tryChangeSymbolAndResolution();
    }
  });

  // Expose global debug commands
  window.dumpCaptureLogs = function() {
    console.log("[Bridge] Querying all capture logs from DB...");
    window.postMessage({ action: "QUERY_CAPTURE_LOGS" }, "*");
  };

  window.exportCaptureLogs = function() {
    console.log("[Bridge] Triggering forensic log download...");
    window.postMessage({ action: "EXPORT_CAPTURE_LOGS" }, "*");
  };

  // Response listeners
  window.addEventListener("message", (event) => {
    if (event.data && event.data.action === "QUERY_CAPTURE_LOGS_RESPONSE") {
      if (!event.data.success) {
        console.error("[Bridge] Failed to query capture logs:", event.data.error);
        return;
      }
      const logs = event.data.logs || [];
      const last100 = logs.slice(-100);
      
      const groupedByStatus = {};
      logs.forEach(item => {
        const status = item.status || "UNKNOWN";
        if (!groupedByStatus[status]) groupedByStatus[status] = 0;
        groupedByStatus[status]++;
      });

      const groupedByStage = {};
      logs.forEach(item => {
        const stage = item.stage || "UNKNOWN";
        if (!groupedByStage[stage]) groupedByStage[stage] = 0;
        groupedByStage[stage]++;
      });

      console.log("=== CAPTURE LOGS AUDIT ===");
      console.log(`1. LoggerDB & logs object store: EXISTS`);
      console.log(`2. Total Record Count: ${logs.length}`);
      console.log("3. Current PENDING Count: " + (groupedByStatus["PENDING"] || 0));
      console.log("4. Current FAILED Count: " + (groupedByStatus["FAILED"] || 0));
      console.log("5. Current SENT Count: " + (groupedByStatus["SENT"] || 0));
      console.log("6. Record Counts grouped by STATUS:", groupedByStatus);
      console.log("7. Record Counts grouped by STAGE:", groupedByStage);
      console.log("8. LAST 100 LOGS:", last100);
    }
    
    if (event.data && event.data.action === "EXPORT_CAPTURE_LOGS_RESPONSE") {
      if (event.data.success) {
        console.log("[Bridge] Forensic export initiated successfully.");
      } else {
        console.error("[Bridge] Forensic export failed:", event.data.error);
      }
    }
  });
})();
