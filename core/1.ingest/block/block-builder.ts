import fs from "fs";
import path from "path";

const TEXT_DIR = path.join(process.cwd(), "data/cleaned_text_output");
const SECTION_DIR = path.join(process.cwd(), "data/block/section_output");
const OUTPUT_DIR = path.join(process.cwd(), "data/block/block_builder_output");

// ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function buildBlocks(text, sections) {
  const blocks = [];

  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    const next = sections[i + 1];

    const start = current.startIndex;
    const end = next ? next.startIndex : text.length;

    const rawContent = text.slice(start, end).trim();

    // 🔥 remove duplicated heading
    const cleanedContent = rawContent.startsWith(current.title)
      ? rawContent.slice(current.title.length).trim()
      : rawContent;

    // 🔥 skip weak blocks
    if (cleanedContent.length < 100) continue;

    blocks.push({
      section_title: current.title,
      content: cleanedContent,
    });
  }

  return blocks;
}

function processFiles() {
  console.log('🚀 Starting block builder...');
  console.log(`📁 TEXT_DIR: ${TEXT_DIR}`);
  console.log(`📁 SECTION_DIR: ${SECTION_DIR}`);
  console.log(`📁 OUTPUT_DIR: ${OUTPUT_DIR}`);

  let textFiles = [];
  try {
    textFiles = fs.readdirSync(TEXT_DIR);
    console.log(`📄 Found ${textFiles.length} files in TEXT_DIR`);
  } catch (err) {
    console.error('❌ Error reading TEXT_DIR:', err.message);
    return;
  }

  const txtFiles = textFiles.filter(f => f.endsWith('.txt'));
  console.log(`📄 ${txtFiles.length} .txt files to process`);

  let processed = 0;
  let skipped = 0;

  txtFiles.forEach((file) => {
    try {
      const textPath = path.join(TEXT_DIR, file);
      const sectionPath = path.join(
        SECTION_DIR,
        file.replace(".txt", ".sections.json")
      );
      const outputPath = path.join(
        OUTPUT_DIR,
        file.replace(".txt", ".blocks.json")
      );

      if (!fs.existsSync(sectionPath)) {
        console.log(`⚠️  Skipping ${file} (missing sections)`);
        skipped++;
        return;
      }

      const text = fs.readFileSync(textPath, "utf-8");
      let sections;
      try {
        sections = JSON.parse(fs.readFileSync(sectionPath, "utf-8"));
      } catch (parseErr) {
        console.error(`❌ JSON parse error for ${file}:`, parseErr.message);
        skipped++;
        return;
      }

      if (!Array.isArray(sections) || sections.length === 0) {
        console.log(`⚠️  No sections for ${file}`);
        skipped++;
        return;
      }

      const blocks = buildBlocks(text, sections);

      fs.writeFileSync(outputPath, JSON.stringify(blocks, null, 2));

      console.log(`✅ Blocks built: ${file} (${blocks.length} blocks)`);
      processed++;
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err.message);
      skipped++;
    }
  });

  console.log(`🎯 Done! Processed: ${processed}, Skipped: ${skipped}`);
}

processFiles();
