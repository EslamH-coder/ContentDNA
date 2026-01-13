import { 
  generateTopicFingerprint, 
  compareTopics,
  isRelevantCompetitorVideo,
  matchesDNATopic,
  isSameStory 
} from '@/lib/topicIntelligence';

export async function POST(request) {
  const { testType, data } = await request.json();
  
  try {
    switch (testType) {
      
      case 'fingerprint':
        // Test fingerprint generation
        const fp = await generateTopicFingerprint(data.title);
        return Response.json({ success: true, fingerprint: fp });
      
      case 'compare':
        // Test comparison between two items
        const result = await compareTopics(
          { title: data.title1 },
          { title: data.title2 }
        );
        return Response.json({ success: true, comparison: result });
      
      case 'competitor':
        // Test competitor video matching
        const compResult = await isRelevantCompetitorVideo(
          { title: data.ideaTitle },
          { title: data.videoTitle }
        );
        return Response.json({ success: true, match: compResult });
      
      case 'dna':
        // Test DNA matching
        const dnaResult = await matchesDNATopic(
          { title: data.title },
          data.dnaTopic
        );
        return Response.json({ success: true, dna: dnaResult });
      
      case 'sameStory':
        // Test if two signals are same story
        const storyResult = await isSameStory(
          { title: data.title1 },
          { title: data.title2 }
        );
        return Response.json({ success: true, sameStory: storyResult });
      
      case 'runAllTests':
        // Run all test cases
        const results = await runAllTestCases();
        return Response.json({ success: true, results });
      
      default:
        return Response.json({ error: 'Unknown test type' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

/**
 * Run all predefined test cases
 */
async function runAllTestCases() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // ========================================
  // TEST CASES - Based on real problems we saw
  // ========================================
  
  const testCases = [
    // TEST 1: Trump Credit Cards vs Trump Iran (should NOT match)
    {
      name: 'Trump Credit Cards vs Trump Iran',
      type: 'competitor',
      input: {
        ideaTitle: 'ترامب: لن نسمح لشركات بطاقات الائتمان باستغلال الشعب الأمريكي',
        videoTitle: 'الرئيس الأميركي دونالد ترمب عن تظاهرات إيران: أميركا مستعدة'
      },
      expected: { relevant: false },
      description: 'Different topics despite same person'
    },
    
    // TEST 2: Trump Tariffs vs Trump China Trade (should match)
    {
      name: 'Trump Tariffs vs Trump China Trade',
      type: 'competitor',
      input: {
        ideaTitle: 'Trump announces new tariffs on Chinese goods',
        videoTitle: 'Trump China trade war escalates with new tariffs'
      },
      expected: { relevant: true },
      description: 'Same topic - US-China trade'
    },
    
    // TEST 3: Iran Bazaar Protests vs China (should NOT match)
    {
      name: 'Iran Protests vs China pattern',
      type: 'dna',
      input: {
        title: 'Why the once loyal bazaar merchants are now protesting in Iran',
        dnaTopic: 'us_china_geopolitics'
      },
      expected: { matches: false },
      description: 'Iran story should not match China DNA'
    },
    
    // TEST 4: Iran Protests should match Iran DNA
    {
      name: 'Iran Protests vs Iran DNA',
      type: 'dna',
      input: {
        title: 'Why the once loyal bazaar merchants are now protesting in Iran',
        dnaTopic: 'iran_domestic'
      },
      expected: { matches: true },
      description: 'Iran protest story should match Iran DNA'
    },
    
    // TEST 5: Same story detection - duplicates
    {
      name: 'Same Story - Oil Price',
      type: 'sameStory',
      input: {
        title1: 'Oil prices surge after Iran tensions escalate',
        title2: 'Crude oil jumps as Iran-US tensions rise'
      },
      expected: { sameStory: true },
      description: 'Should detect as same story'
    },
    
    // TEST 6: Different stories - both about oil
    {
      name: 'Different Oil Stories',
      type: 'sameStory',
      input: {
        title1: 'Oil prices surge after Iran tensions',
        title2: 'Saudi Arabia increases oil production'
      },
      expected: { sameStory: false },
      description: 'Different oil stories should not group'
    },
    
    // TEST 7: Credit card story - correct DNA
    {
      name: 'Credit Card Story DNA',
      type: 'dna',
      input: {
        title: 'ترامب: لن نسمح لشركات بطاقات الائتمان باستغلال الشعب الأمريكي',
        dnaTopic: 'us_domestic_finance'
      },
      expected: { matches: true },
      description: 'Credit card story should match US domestic finance'
    },
    
    // TEST 8: Arabic and English same topic (now with AI extraction)
    {
      name: 'Arabic vs English - Same Topic',
      type: 'sameStory',
      input: {
        title1: 'ترامب يفرض رسوم جمركية جديدة على الصين',
        title2: 'Trump imposes new tariffs on China'
      },
      expected: { sameStory: true },
      description: 'Should match across languages with AI extraction'
    },
    
    // TEST 9: Venezuela vs Iran (both protests, different countries)
    {
      name: 'Venezuela vs Iran Protests',
      type: 'sameStory',
      input: {
        title1: 'Protests erupt in Venezuela against government',
        title2: 'Iran protests spread to more cities'
      },
      expected: { sameStory: false },
      description: 'Different countries, should not match'
    },
    
    // TEST 10: Crypto stories
    {
      name: 'Bitcoin Stories - Related',
      type: 'competitor',
      input: {
        ideaTitle: 'Bitcoin breaks $100,000 for first time',
        videoTitle: 'Why Bitcoin is reaching new highs'
      },
      expected: { relevant: true },
      description: 'Related crypto stories should match'
    },
  ];
  
  // Run each test
  for (const test of testCases) {
    try {
      let result;
      
      switch (test.type) {
        case 'competitor':
          result = await isRelevantCompetitorVideo(
            { title: test.input.ideaTitle },
            { title: test.input.videoTitle }
          );
          break;
        case 'dna':
          result = await matchesDNATopic(
            { title: test.input.title },
            test.input.dnaTopic
          );
          break;
        case 'sameStory':
          result = await isSameStory(
            { title: test.input.title1 },
            { title: test.input.title2 }
          );
          break;
      }
      
      // Check if result matches expected
      const passed = checkExpectation(result, test.expected);
      
      results.tests.push({
        name: test.name,
        description: test.description,
        passed,
        expected: test.expected,
        actual: result,
        input: test.input
      });
      
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
      
    } catch (error) {
      results.tests.push({
        name: test.name,
        passed: false,
        error: error.message,
        stack: error.stack
      });
      results.failed++;
    }
  }
  
  results.summary = `${results.passed}/${results.tests.length} tests passed`;
  return results;
}

function checkExpectation(result, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (result[key] !== value) return false;
  }
  return true;
}
