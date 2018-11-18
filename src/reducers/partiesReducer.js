import { FETCH_PARTIES, RECEIVE_PARTIES, CHANGE_CURRENT_PARTIE, FETCH_PARTIE_ARTICLES, FETCH_NEXT_TEN_PARTY_NEWS } from '../actions/actionTypes';

const initialState = {
    partieList: [],
    currentPartie: "",
    partieNews: null
}

export default function parties(state = initialState, action) {
  switch (action.type) {
    case FETCH_PARTIES:
      return action;

    case RECEIVE_PARTIES:
      return {
        ...state,
        partieList: action.parties
      }

    case CHANGE_CURRENT_PARTIE:
      return {
        ...state,
        currentPartie: action.partie
      }
    case FETCH_PARTIE_ARTICLES:
      return {
        ...state,
        partieNews: action.news
      }

    case FETCH_NEXT_TEN_PARTY_NEWS:
      let all_articles = []

      for(let j = 0; j < state.partieNews.length; j++) {
        all_articles.push(state.partieNews[j])
      }

      for(let i = 0; i < action.ten_articles.length; i++) {
        all_articles.push(action.ten_articles[i])
      }

      return {
        ...state,
        partieNews: all_articles
      }

    default:
      return state;
  }
}
