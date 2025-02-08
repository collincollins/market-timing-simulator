// netlify/functions/getVisitorDocuments.js

const { MongoClient, ServerApiVersion } = require('mongodb');

// only log if the deploy context is 'deploy-preview' or 'branch-deploy'
const shouldLog =
  process.env.CONTEXT === 'deploy-preview' ||
  process.env.CONTEXT === 'branch-deploy';

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, deprecationErrors: true },
});

let isConnected = false;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    if (!isConnected) {
      await client.connect();
      isConnected = true;
      if (shouldLog) console.log('Connected to MongoDB.');
    }

    // determine the appropriate database name.
    const defaultDbName =
      process.env.CONTEXT === 'deploy-preview'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');

    // base query criteria common to both modes.
    let query = {
      durationOfGame: { $gte: 10 },
      buys: { $exists: true },
      sells: { $exists: true },
      portfolioCAGR: { $exists: true },
      buyHoldCAGR: { $exists: true }
    };

    // read the realMode value from the query string (if provided)
    const { realMode } = event.queryStringParameters || {};

    if (realMode === "true") {
      // for real market mode:
      // - the document must be explicitly marked as realMode true.
      // - both startRealMarketDate and endRealMarketDate must exist and be non-null/non-zero.
      query.realMode = true;
      query.startRealMarketDate = { $exists: true, $nin: [null, 0] };
      query.endRealMarketDate = { $exists: true, $nin: [null, 0] };
    } else {
      // for simulated market mode:
      // - the document must not be marked as real mode (i.e. realMode is false, null, or missing)
      // - and neither startRealMarketDate nor endRealMarketDate should hold a meaningful value.
      query.$and = [
        {
          $or: [
            { realMode: false },
            { realMode: { $exists: false } },
            { realMode: null }
          ]
        },
        {
          $or: [
            { startRealMarketDate: { $exists: false } },
            { startRealMarketDate: { $in: [null, 0] } }
          ]
        },
        {
          $or: [
            { endRealMarketDate: { $exists: false } },
            { endRealMarketDate: { $in: [null, 0] } }
          ]
        }
      ];
    }

    if (shouldLog) {
      console.log('getVisitorDocuments query:', JSON.stringify(query, null, 2));
    }

    const visitorDocs = await visitorsCollection.find(query).toArray();

    if (shouldLog) {
      console.log(`Found ${visitorDocs.length} visitor document(s).`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(visitorDocs),
    };
  } catch (error) {
    console.error('Error in getVisitorDocuments function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};