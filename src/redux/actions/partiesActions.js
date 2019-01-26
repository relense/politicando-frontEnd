import * as types from './actionTypes';
import { apiUrls } from '../../api/apiUrls';
import { get } from '../../api/Api';

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

export function receiveNext10Articles(articles) {
  return {
    type: types.FETCH_NEXT_TEN_PARTY_NEWS,
    tenArticles: articles
  }
}

export function setAvailableNews(valid) {
  return {
    type: types.SET_AVAILABLE_NEWS_PARTIES,
    valid: valid
  }
}

export function setPartieLoading(valid) {
  return {
    type: types.LOADING_PARTIE_NEWS,
    valid: valid
  }
}

export const loadParties = () => {
  return async function(dispatch) {
    try {
      const response = await get(apiUrls.getParties);
      dispatch(receiveParties(response));
    } catch(error) {
      console.log(error);
    }
  }
}

export const asyncChangeCurrentPartie = (partie) => {
  return async function(dispatch) {
    try {
      dispatch(setPartieLoading(true));
      dispatch(setAvailableNews(true));
      dispatch(receivePartieNews([]))
      dispatch(changeCurentPartie(partie));
    } catch(error) {
      console.log(error);
    } finally {
      dispatch(setPartieLoading(false));
    }
  }
}

export const asyncGetPartieNews = (partie_id) => {
  return async function(dispatch) {
    try {
      dispatch(setPartieLoading(true));
      const response = await get(apiUrls.getPartieNews.replace('{partie_id}', partie_id));
      dispatch(receivePartieNews(response));
      if(response.length === 0) 
        dispatch(setAvailableNews(false));
    } catch(error) {
      console.log(error);
    } finally {
      dispatch(setPartieLoading(false));
    }
  }
}

export const loadNextTenPartyArticles = (party_id, article_id) => {
  return async function(dispatch){
      try {
          dispatch(setPartieLoading(true));
          const response = await get(apiUrls.getNextTenPartieNews.replace('{article_id}', article_id).replace('{party_id}', party_id));
          dispatch(receiveNext10Articles(response));
          if(response.length === 0)
            dispatch(setAvailableNews(false));
      } catch (error) {
          console.log(error);
      } finally {
        dispatch(setPartieLoading(false));
      }
  }
}
