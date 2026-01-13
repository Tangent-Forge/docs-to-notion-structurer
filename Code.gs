/**
 * Docs-to-Notion Structurer - Google Workspace Add-on
 * Convert Google Docs content into structured Notion pages
 */

const UI_LABEL = 'Docs to Notion Structurer';

// ========================================
// Add-on Initialization
// ========================================

/**
 * Called when the add-on is installed
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Called when a document is opened
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('Docs to Notion')
    .addItem('Convert to Notion', 'showSidebar')
    .addItem('Setup API Key', 'setupApiKey')
    .addToUi();
}

/**
 * Opens the sidebar
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle(UI_LABEL);
  DocumentApp.getUi().showSidebar(html);
}

// ========================================
// API Functions (Called from Sidebar)
// ========================================

/**
 * API: Save Notion API key
 */
function apiSaveApiKey(apiKey) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty('notionApiKey', apiKey);
    return { success: true };
  } catch (err) {
    console.error('Save API key failed:', err);
    throw new Error('Save API key failed: ' + err.message);
  }
}

/**
 * API: Check API key status
 */
function apiCheckApiKey() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const apiKey = properties.getProperty('notionApiKey');
    return { hasKey: !!apiKey };
  } catch (err) {
    console.error('Check API key failed:', err);
    throw new Error('Check API key failed: ' + err.message);
  }
}

/**
 * API: Get current Doc content
 */
function apiGetDocContent() {
  try {
    const doc = DocumentApp.getActiveDocument();
    const content = DocsParser.parseDocument(doc);
    return content;
  } catch (err) {
    console.error('Get Doc content failed:', err);
    throw new Error('Get Doc content failed: ' + err.message);
  }
}

/**
 * API: Convert Doc to Notion
 */
function apiConvertToNotion(pageId, options) {
  try {
    const doc = DocumentApp.getActiveDocument();
    const content = DocsParser.parseDocument(doc);
    const result = NotionAPI.createPage(pageId, content, options);
    return result;
  } catch (err) {
    console.error('Convert failed:', err);
    throw new Error('Convert failed: ' + err.message);
  }
}

// ========================================
// Docs Parser Module
// ========================================

const DocsParser = (() => {
  function parseDocument(doc) {
    const body = doc.getBody();
    const paragraphs = body.getParagraphs();
    const content = {
      title: doc.getName(),
      blocks: []
    };
    
    paragraphs.forEach(paragraph => {
      const text = paragraph.getText();
      const heading = paragraph.getHeading();
      const type = paragraph.getType();
      
      if (type === DocumentApp.ParagraphType.HEADING_1) {
        content.blocks.push({
          type: 'heading_1',
          content: text
        });
      } else if (type === DocumentApp.ParagraphType.HEADING_2) {
        content.blocks.push({
          type: 'heading_2',
          content: text
        });
      } else if (type === DocumentApp.ParagraphType.HEADING_3) {
        content.blocks.push({
          type: 'heading_3',
          content: text
        });
      } else if (text.trim() !== '') {
        content.blocks.push({
          type: 'paragraph',
          content: text
        });
      }
    });
    
    // Parse lists
    const listItems = body.getListItems();
    const lists = {};
    listItems.forEach(item => {
      const listId = item.getListId();
      if (!lists[listId]) {
        lists[listId] = [];
      }
      lists[listId].push({
        type: 'list_item',
        content: item.getText()
      });
    });
    
    // Add lists to content
    Object.values(lists).forEach(list => {
      content.blocks.push({
        type: 'bulleted_list',
        items: list
      });
    });
    
    return content;
  }
  
  return {
    parseDocument
  };
})();

// ========================================
// Notion Mapper Module
// ========================================

const NotionMapper = (() => {
  function mapToNotionBlocks(content) {
    const notionBlocks = [];
    
    content.blocks.forEach(block => {
      switch (block.type) {
        case 'heading_1':
          notionBlocks.push({
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [{
                type: 'text',
                text: { content: block.content }
              }]
            }
          });
          break;
        case 'heading_2':
          notionBlocks.push({
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{
                type: 'text',
                text: { content: block.content }
              }]
            }
          });
          break;
        case 'heading_3':
          notionBlocks.push({
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [{
                type: 'text',
                text: { content: block.content }
              }]
            }
          });
          break;
        case 'paragraph':
          notionBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: block.content }
              }]
            }
          });
          break;
        case 'bulleted_list':
          block.items.forEach(item => {
            notionBlocks.push({
              object: 'block',
              type: 'bulleted_list_item',
              bulleted_list_item: {
                rich_text: [{
                  type: 'text',
                  text: { content: item.content }
                }]
              }
            });
          });
          break;
      }
    });
    
    return notionBlocks;
  }
  
  return {
    mapToNotionBlocks
  };
})();

// ========================================
// Notion API Module
// ========================================

const NotionAPI = (() => {
  function getApiKey() {
    const properties = PropertiesService.getScriptBuilder.getProperties();
    return properties.getProperty('notionApiKey');
  }
  
  function createPage(pageId, content, options = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Notion API key not configured');
    }
    
    const notionBlocks = NotionMapper.mapToNotionBlocks(content);
    
    // Create page
    const pageData = {
      parent: {
        page_id: pageId
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: content.title
              }
            }
          ]
        }
      },
      children: notionBlocks
    };
    
    const response = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      payload: JSON.stringify(pageData),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (!result.id) {
      throw new Error('Failed to create Notion page: ' + JSON.stringify(result));
    }
    
    return {
      success: true,
      pageId: result.id,
      url: result.url,
      blocksProcessed: notionBlocks.length
    };
  }
  
  function testConnection(apiKey) {
    const response = UrlFetchApp.fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Notion-Version': '2022-06-28'
      },
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    return {
      success: response.getResponseCode() === 200,
      user: result
    };
  }
  
  return {
    createPage,
    testConnection
  };
})();
