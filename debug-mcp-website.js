const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function testMCPInWebsiteDir() {
  const testWebsiteDir = '/Users/david/Developer/Gauntlet/taskr-test-website';
  console.log('🔍 Testing MCP server in taskr-test-website directory...');
  console.log('Current working directory:', process.cwd());
  console.log('Target test directory:', testWebsiteDir);
  
  let transport = null;
  let client = null;
  
  try {
    // Create transport with the exact same config as the extension
    console.log('📡 Creating MCP transport...');
    transport = new StdioClientTransport({
      command: '/opt/homebrew/bin/npx',
      args: ['-y', '--package=task-master-ai', 'task-master-ai'],
      cwd: testWebsiteDir, // Use the test website directory
      env: process.env
    });

    // Set up event handlers
    transport.onerror = (error) => {
      console.error('❌ Transport error:', error);
    };

    transport.onclose = () => {
      console.log('🔌 Transport closed');
    };

    // Monitor the child process
    transport.onmessage = (message) => {
      console.log('📤 Server message:', message);
    };

    // Create client
    client = new Client(
      {
        name: 'debug-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    console.log('🔗 Connecting client to transport...');
    await client.connect(transport);

    console.log('✅ Connected! Testing get_tasks tool...');
    
    // Test the get_tasks tool like the extension does
    const result = await client.callTool({
      name: 'get_tasks',
      arguments: {
        projectRoot: testWebsiteDir,
        withSubtasks: true
      }
    });

    console.log('📋 Got tasks result:', result);
    console.log('📊 Number of tasks:', result.content?.[0]?.text ? JSON.parse(result.content[0].text).data?.tasks?.length : 'unknown');

  } catch (error) {
    console.error('❌ Error during MCP test:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
  } finally {
    // Clean up
    console.log('🧹 Cleaning up...');
    
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.log('Warning: Error closing client:', e.message);
      }
    }
    
    if (transport) {
      try {
        await transport.close();
      } catch (e) {
        console.log('Warning: Error closing transport:', e.message);
      }
    }
  }
}

testMCPInWebsiteDir().catch(console.error); 