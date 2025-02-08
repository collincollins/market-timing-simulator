// netlify/functions/updateVisitorDocument.js

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Only log if the deploy context is 'deploy-preview' or 'branch-deploy'
const shouldLog =
  process.env.CONTEXT === 'deploy-preview' ||
  process.env.CONTEXT === 'branch-deploy';

const uri = process.env.MONGODB_ENV_VAR_CAN_YOU_BEAT_THE_MARKET;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    deprecationErrors: true,
  },
});

let isConnected = false;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    if (!isConnected) {
      await client.connect();
      isConnected = true;
      if (shouldLog) console.log('Connected to MongoDB for updateVisitorDocument.');
    }

    const defaultDbName =
      process.env.CONTEXT === 'branch-deploy'
        ? 'canyoubeatthemarket-test'
        : 'canyoubeatthemarket';
    const dbName = process.env.MONGODB_DB_NAME || defaultDbName;
    const database = client.db(dbName);
    const visitorsCollection = database.collection('visitors');

    const payload = JSON.parse(event.body);
    if (shouldLog) {
      console.log('updateVisitorDocument payload:', payload);
    }

    const {
      documentId,
      hasStarted,
      naturalEnd,
      valid,
      win,
      winStreak,
      endGameDate,
      durationOfGame,
      portfolioValue,
      buyHoldFinalValue,
      portfolioCAGR,
      buyHoldCAGR,
      buys,
      sells,
      realMode,
      startRealMarketDate,
      endRealMarketDate
    } = payload;

    if (!documentId) {
      if (shouldLog) console.error('Missing documentId in payload.');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing documentId in payload.' }),
      };
    }

    // convert documentId string to an ObjectId
    const filter = { _id: new ObjectId(documentId) };

    const updateData = {
      hasStarted,
      naturalEnd,
      valid,
      win,
      winStreak,
      endGameDate: new Date(endGameDate),
      durationOfGame,
      portfolioValue,
      buyHoldFinalValue,
      portfolioCAGR,
      buyHoldCAGR,
      buys,
      sells,
      realMode,
      ...(startRealMarketDate && { simulationStartDate: new Date(startRealMarketDate) }),
      ...(endRealMarketDate && { simulationEndDate: new Date(endRealMarketDate) })
    };

    if (shouldLog) {
      console.log('updateVisitorDocument updateData:', updateData);
    }

    const result = await visitorsCollection.updateOne(
      filter,
      { $set: updateData }
    );

    if (shouldLog) {
      console.log('updateOne result:', result);
    }

    if (result.modifiedCount === 1) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Visitor document updated successfully.' }),
      };
    } else {
      if (shouldLog) console.error('Failed to update visitor document:', result);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to update visitor document.' }),
      };
    }
  } catch (error) {
    console.error('Error in updateVisitorDocument function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};