
const module = require('module');
const originalLoader = module._load;

module._load = function(request, parent, isMain) {
    if (request === '../shared/utils/agent-executor') {
        return {
            runSafeAgent: (agentName) => {
                console.log(`\nℹ️ [INFO] Mocked runSafeAgent for: ${agentName}`);
                return Promise.resolve({ data: { agentName, status: "mocked" } });
            }
        };
    }
    if (request === '../core/3.query/hierarchical-summarizer') {
        return {
            summarizeTimeframeThesis: (timeframe, _, parentThesis) => {
                console.log(`\nℹ️ [INFO] Mocked summarizeTimeframeThesis for: ${timeframe}`);
                return Promise.resolve({ 
                    timeframe, 
                    summary: `mock ${timeframe} thesis`, 
                    parent_timeframe: parentThesis?.timeframe 
                });
            }
        };
    }
    if (request === '../shared/utils/llm-utils') {
        return {
            callLLM: () => Promise.resolve({ htf_bias: "mock", reasoning: "mock" })
        };
    }
    return originalLoader(request, parent, isMain);
};
