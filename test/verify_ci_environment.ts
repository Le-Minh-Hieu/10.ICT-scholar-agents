
import 'dotenv/config';

function verifyCIEnvironment() {
    console.log('--- CI Environment Verification ---\n');
    console.log(`Running from: ${process.cwd()}`);

    // 1. Check for VECTOR_STORE_DIR
    const vectorStoreDir = process.env.VECTOR_STORE_DIR;
    console.log(`process.env.VECTOR_STORE_DIR: ${vectorStoreDir}`);
    if (vectorStoreDir === 'data/vectors_vertex') {
        console.log('  [PASS] VECTOR_STORE_DIR is correctly set to data/vectors_vertex.');
    } else if (!vectorStoreDir) {
        console.log('  [FAIL] CRITICAL: process.env.VECTOR_STORE_DIR is UNDEFINED.');
        console.log('         This will cause the system to fall back to the legacy \'data/vectors\' directory, which contains 3072-dimension vectors.');
        console.log('         This is the likely root cause of the DIMENSION_MISMATCH error.');
    } else {
        console.log(`  [FAIL] UNEXPECTED: VECTOR_STORE_DIR is set to an unexpected value: ${vectorStoreDir}`);
    }

    console.log('\n--- Verification Complete ---\n');
}

verifyCIEnvironment();
