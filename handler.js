'use strict';

const {getDDBAlarmsParams} = require('./helpers');

const axios = require('axios').default;
const {Expo} = require('expo-server-sdk');
const AWS = require('aws-sdk');

AWS.config.setPromisesDependency(require('bluebird'));
let expo = new Expo();

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const WowClient = require('./client/wow');
const WowNotificationClient = require('./client/wowNotification');

module.exports.dbWriter = async (event) => {
  const query = await dynamoDb.scan(getDDBAlarmsParams()).promise();

  const realms = new Set();
  if (query.Items && query.Items.length > 0) {
    const {Items} = query;
    Items.forEach(item => {
      realms.add(item.realm.toLowerCase());
    });
  }

  const wowClient = new WowClient(axios, realms);
  const realmFactionItemMap = await wowClient.buildRealmFactionItemMap();

  const wowNotificationClient = new WowNotificationClient(expo, dynamoDb);
  if (query.Items && query.Items.length > 0) {
    const {Items} = query;

    wowNotificationClient.addItems(realmFactionItemMap, Items);
    await wowNotificationClient.uploadPushNotifications();
  }

  return {
    statusCode: 200,
    body: JSON.stringify( {message: 'Successfully generated push notifications', input: event}),
  };
};
