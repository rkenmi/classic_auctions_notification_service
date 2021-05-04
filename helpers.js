module.exports = {
  toWoWCurrency: (value) => {
    const texts = [];
    if (value > 9999) {
      texts.push(`${Math.floor(value / 10000)}g`);
    }
    if (value > 99) {
      texts.push(`${Math.floor((value % 100) / 100)}s`);
    }
    texts.push(`${Math.floor(value % 100)}c`);

    return texts.join(' ');
  },

  getDDBAlarmsParams: () => ({
    TableName: process.env.CLASSIC_AH_ALARMS_TABLE,
    FilterExpression: "#disabled = :disabled",
    ExpressionAttributeNames:{
      "#disabled": "disabled"
    },
    ExpressionAttributeValues: {
      ":disabled": false,
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
      ":enabled": true,
    },
    ReturnValues: "UPDATED_NEW"
  })
};

