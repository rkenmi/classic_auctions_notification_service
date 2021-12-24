'use strict';

const {toWoWCurrency} = require('../helpers');
const {getDDBUpdateAlarmParams} = require('../helpers');
const {normalizeRealm} = require('../helpers');
const {Expo} = require('expo-server-sdk');

class WowNotificationClient {
  constructor(expo, dynamoDb) {
    this.expo = expo;
    this.dynamoDb = dynamoDb;
    this.itemMetadataList = [];
    this.expoMessages = [];
  }

  addItems(realmFactionItemMap, items) {
    for (let item of items) {
      this.addItem(realmFactionItemMap, item);
    }
    this.buildPushNotifications()
  }

  addItem(realmFactionItemMap, item) {
    const wowItemMap = realmFactionItemMap[normalizeRealm(item.realm)][item.faction.toLowerCase()];
    const itemInfo = wowItemMap[item.itemId];

    if (itemInfo && itemInfo.minBuyout > 0) {
      const minBuyout = itemInfo.minBuyout;

      if (!Expo.isExpoPushToken(item.pushToken)) {
        console.warn(`Push token ${item.pushToken} is not a valid Expo push token`);
        return;
      }

      if (item.priceComparator === 0 && minBuyout < item.priceThreshold) {
        this.itemMetadataList.push({...item, minBuyout});
      } else if (item.priceComparator === 1 && minBuyout > item.priceThreshold) {
        this.itemMetadataList.push({...item, minBuyout});
      }
    }
  }

  buildPushNotifications() {
    for (let itemMetadata of this.itemMetadataList) {
      const {pushToken} = itemMetadata;

      // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
      this.expoMessages.push({
        to: pushToken,
        sound: 'default',
        body: `Price alert for ${itemMetadata.itemName} - ${toWoWCurrency(itemMetadata.minBuyout)}`,
        priority: 'high',
        data: {withSome: 'data'},
      });
    }
  }

  updateUserAlarms() {
    this.itemMetadataList.forEach(pushNotification => {
      this.dynamoDb.update(getDDBUpdateAlarmParams(pushNotification), (err, data) => {
        if (err) {
          console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        }
      });
      this.sendToAnalyticsQueue(pushNotification);
    })
  }

  sendToAnalyticsQueue(notification) {
    // TODO
  }

  async uploadPushNotifications() {
    this.updateUserAlarms();

    // The Expo push notification service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications. We
    // recommend you batch your notifications to reduce the number of requests
    // and to compress them (notifications with similar content will get
    // compressed).
    let chunks = this.expo.chunkPushNotifications(this.expoMessages);
    let tickets = [];
    // Send the chunks to the Expo push notification service. There are
    // different strategies you could use. A simple one is to send one chunk at a
    // time, which nicely spreads the load out over time:
    for (let chunk of chunks) {
      try {
        let ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
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
}

module.exports = WowNotificationClient;
