'use strict';

const {normalizeRealm, getDDBAlarmsParams, getDDBUpdateAlarmParams, toWoWCurrency} = require('./helpers');

const axios = require('axios').default;
const { Expo } = require('expo-server-sdk');
const AWS = require('aws-sdk');

AWS.config.setPromisesDependency(require('bluebird'));
let expo = new Expo();

const dynamoDb = new AWS.DynamoDB.DocumentClient();

async function updateRealmFactionItemMap(realmFactionItemMap, urls) {
  const results = await axios.all(urls);
  if (results && results.length > 0) {
    for (const res of results) {
      const slugData = res.data.slug.split('-');
      const faction = slugData.pop();
      const realm = slugData.join('-');

      if ( faction === 'alliance' ) {
        const allianceItemsMap = {};
        res.data.data.forEach((item) => allianceItemsMap[item.itemId] = item);
        realmFactionItemMap[realm]['alliance'] = allianceItemsMap;
      } else {
        const hordeItemsMap = {};
        res.data.data.forEach((item) => hordeItemsMap[item.itemId] = item);
        realmFactionItemMap[realm]['horde'] = hordeItemsMap;
      }
    }
  }
}

function addPushNotification(pushNotifications, realmFactionItemMap, item) {
  const wowItemMap = realmFactionItemMap[normalizeRealm(item.realm)][item.faction.toLowerCase()];
  const itemInfo = wowItemMap[item.itemId];

  if (itemInfo && itemInfo.minBuyout > 0) {
    const minBuyout = itemInfo.minBuyout;

    if (item.priceComparator === 0 && minBuyout < item.priceThreshold) {
      pushNotifications.push({...item, minBuyout});
    } else if (item.priceComparator === 1 && minBuyout > item.priceThreshold) {
      pushNotifications.push({...item, minBuyout});
    }
  }
}

module.exports.dbWriter = async (event) => {
  const query = await dynamoDb.scan(getDDBAlarmsParams()).promise();

  let messages = [];
  const realms = new Set();
  if (query.Items && query.Items.length > 0) {
    const {Items} = query;
    Items.forEach(item => {
      realms.add(item.realm.toLowerCase());
    });
  }

  const realmFactionItemMap = {};
  const allianceUrls = [];
  const hordeUrls = [];
  for (const realmName of realms) {
    const realm = normalizeRealm(realmName);
    realmFactionItemMap[realm] = {};
    allianceUrls.push(axios.get(`https://api.nexushub.co/wow-classic/v1/items/${realm}-alliance`));
    hordeUrls.push(axios.get(`https://api.nexushub.co/wow-classic/v1/items/${realm}-horde`));
  }

  await updateRealmFactionItemMap(realmFactionItemMap, allianceUrls.concat(hordeUrls));

  const pushNotifications = [];
  if (query.Items && query.Items.length > 0) {
    const {Items} = query;
    Items.forEach(item => {
      addPushNotification(pushNotifications, realmFactionItemMap, item);
    });

    console.log(`Found ${pushNotifications.length} notifications`);
    for (let pushNotification of pushNotifications) {
      // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
      const {pushToken} = pushNotification;

      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }

      // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
      messages.push({
        to: pushToken,
        sound: 'default',
        body: `Price alert for ${pushNotification.itemName} - ${toWoWCurrency(pushNotification.minBuyout)}`,
        priority: 'high',
        data: { withSome: 'data' },
      });

      await dynamoDb.update(getDDBUpdateAlarmParams(pushNotification), function(err, data) {
        if (err) {
          console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
          console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
        }
      }).promise();
    }

    // The Expo push notification service accepts batches of notifications so
// that you don't need to send 1000 requests to send 1000 notifications. We
// recommend you batch your notifications to reduce the number of requests
// and to compress them (notifications with similar content will get
// compressed).
    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
      // Send the chunks to the Expo push notification service. There are
      // different strategies you could use. A simple one is to send one chunk at a
      // time, which nicely spreads the load out over time:
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log(ticketChunk);
        tickets.push(...ticketChunk);
        // NOTE: If a ticket contains an error code in ticket.details.error, you
        // must handle it appropriately. The error codes are listed in the Expo
        // documentation:
        // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
      } catch (error) {
        console.error(error);
      }
    }

  }

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};
