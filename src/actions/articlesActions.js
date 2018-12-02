import * as types from './actionTypes';
import { apiUrls } from '../api/apiUrls';
import { get } from '../api/Api';

export function receivedArticles(articles) {
    return {
        type: types.FETCH_ARTICLES,
        allArticles: articles
    }
}

export function receiveNext10Articles(articles) {
    return {
        type: types.FETCH_NEXT_TEN,
        tenArticles: articles
    }
}

export function reveiveArticle(article) {
    return {
        type: types.GET_ARTICLE,
        currentArticle: article
    }
}

export const loadArticles = () => {
    return async function(dispatch){
        try {
            const response = await get(apiUrls.getNews)
            dispatch(receivedArticles(response))
        } catch (error) {
            console.log(error)
        }
    }
}

export const loadNextTenArticles = (article_id) => {
  return async function(dispatch){
      try {
          const response = await get(apiUrls.getNextTenNews.replace('{article_id}', article_id))
          dispatch(receiveNext10Articles(response))
      } catch (error) {
          console.log(error)
      }
  }
}

export const asyncLoadArticle = (article_id) => {
    return async function(dispatch){
        try {
            const response = await get(apiUrls.getArticle.replace('{article_id}', article_id))
            dispatch(reveiveArticle(response))
        } catch (error) {
            console.log(error)
        }
    }
}
