import { FETCH_ARTICLES, FETCH_NEXT_TEN, GET_ARTICLE } from '../actions/actionTypes';

const initialState = {
    all_articles: [],
    ten_articles: [],
    current_article: {}
}

export default function articles(state = initialState, action) {
  switch (action.type) {
    case FETCH_ARTICLES:
      return action;

    case FETCH_NEXT_TEN:
      let all_articles = []

      for(let j = 0; j < state.all_articles.length; j++) {
        all_articles.push(state.all_articles[j])
      }

      for(let i = 0; i < action.ten_articles.length; i++) {
        all_articles.push(action.ten_articles[i])
      }

      return {
        ...state,
        all_articles: all_articles
      }
    
    case GET_ARTICLE:
      return {
        ...state,
        current_article: action.current_article
      }

    default:
      return state;
  }
}
