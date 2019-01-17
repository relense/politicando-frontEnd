import * as types from './actionTypes';
import { apiUrls } from '../../api/apiUrls';
import { get } from '../../api/Api';
import { setLoading } from './articlesActions';

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
      dispatch(setLoading(true));
      dispatch(changeCurentPartie(partie));
    } catch(error) {
      console.log(error);
    } finally {
      dispatch(setLoading(false));
    }
  }
}

export const asyncGetPartieNews = (partie_id) => {
  return async function(dispatch) {
    try {
      dispatch(setLoading(true));
      const response = await get(apiUrls.getPartieNews.replace('{partie_id}', partie_id));
      dispatch(receivePartieNews(response));
    } catch(error) {
      console.log(error);
    } finally {
      dispatch(setLoading(false));
    }
  }
}

export const loadNextTenPartyArticles = (party_id, article_id) => {
  return async function(dispatch){
      try {
          dispatch(setLoading(true));
          const response = await get(apiUrls.getNextTenPartieNews.replace('{article_id}', article_id).replace('{party_id}', party_id));
          dispatch(receiveNext10Articles(response));
      } catch (error) {
          console.log(error);
      } finally {
        dispatch(setLoading(false));
      }
  }
}
