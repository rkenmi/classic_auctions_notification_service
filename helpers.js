module.exports = {
  toWoWCurrency: (value) => {
    const texts = [];
    if (value > 9999) {
      texts.push(`${value / 10000}g`);
    }
    if (value > 99) {
      texts.push(`${(value / 100) % 100}s`);
    }
    texts.push(`${value % 100}c`);

    return texts.join(' ');
  },

  getDDBAlarmsParams: () => ({
    TableName: process.env.CLASSIC_AH_ALARMS_TABLE,
    FilterExpression: "#disabled = :disabled",
    ExpressionAttributeNames:{
      "#disabled": "disabled"
    },
    ExpressionAttributeValues: {
      ":disabled": 0,
    }
  }),


  getDDBUpdateAlarmParams: (pushNotification) => ({
    TableName: process.env.CLASSIC_AH_ALARMS_TABLE,
    UpdateExpression: "set #disabled = :enabled",
    Key: {
      "userId": pushNotification.userId,
      "alarmId": pushNotification.alarmId
    },
    ExpressionAttributeNames:{
      "#disabled": "disabled"
    },
    ExpressionAttributeValues: {
      ":enabled": 1,
    },
    ReturnValues: "UPDATED_NEW"
  }),

  normalizeRealm: (realm) => realm.replace(' ', '-').toLowerCase()
};

