import * as types from './actionTypes';
import { apiUrls } from '../api/apiUrls';
import { get } from '../api/Api';

export function receiveParties(parties) {
  return {
    type: types.RECEIVE_PARTIES,
    parties: parties
  };
}

export function changeCurentPartie(partie) {
  return {
    type: types.CHANGE_CURRENT_PARTIE,
    partie: partie
  }
}

export function receivePartieNews(response) {
  return {
    type: types.FETCH_PARTIE_ARTICLES,
    news: response
  }
}

export const loadParties = () => {
  return async function(dispatch) {
    try {
      const response = await get(apiUrls.getParties);
      dispatch(receiveParties(response))
    } catch(error) {
      console.log(error)
    }
  }
}

export const asyncChangeCurrentPartie = (partie) => {
  return async function(dispatch) {
    try {
      dispatch(changeCurentPartie(partie))
    } catch(error) {
      console.log(error)
    }
  }
}

export const asyncGetPartieNews = (partie_id) => {
  return async function(dispatch) {
    try {
      const response = await get(apiUrls.getPartieNews.replace('{partie_id}', partie_id))
      dispatch(receivePartieNews(response))
    } catch(error) {
      console.log(error)
    }
  }
}
