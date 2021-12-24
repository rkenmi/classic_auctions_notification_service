'use strict';

const {normalizeRealm} = require('../helpers');

class WowClient {
  constructor(axios, realms) {
    this.axios = axios;
    this.realms = realms;
  }

  async buildRealmFactionItemMap() {
    const realmFactionItemMap = {};
    const allianceUrls = [];
    const hordeUrls = [];
    for (const realmName of this.realms) {
      const realm = normalizeRealm(realmName);
      realmFactionItemMap[realm] = {};
      allianceUrls.push(this.axios.get(`https://api.nexushub.co/wow-classic/v1/items/${realm}-alliance`));
      hordeUrls.push(this.axios.get(`https://api.nexushub.co/wow-classic/v1/items/${realm}-horde`));
    }

    await this._updateRealmFactionItemMap(realmFactionItemMap, allianceUrls.concat(hordeUrls));
    return realmFactionItemMap;
  }

  async _updateRealmFactionItemMap(realmFactionItemMap, urls) {
    const results = await this.axios.all(urls);
    if (results && results.length > 0) {
      for (const res of results) {
        const slugData = res.data.slug.split('-');
        const faction = slugData.pop();
        const realm = slugData.join('-');

        if (faction === 'alliance') {
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
}

module.exports = WowClient;
