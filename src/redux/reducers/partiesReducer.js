import { FETCH_PARTIES, RECEIVE_PARTIES, CHANGE_CURRENT_PARTIE, FETCH_PARTIE_ARTICLES,
   FETCH_NEXT_TEN_PARTY_NEWS, SET_AVAILABLE_NEWS_PARTIES, LOADING_PARTIE_NEWS } from '../actions/actionTypes';

const initialState = {
    partieList: [],
    currentPartie: "",
    partieNews: null,
    moreNews: true,
    partieLoading: false
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
      let allArticles = []

      for(let j = 0; j < state.partieNews.length; j++) {
        allArticles.push(state.partieNews[j])
      }

      for(let i = 0; i < action.tenArticles.length; i++) {
        allArticles.push(action.tenArticles[i])
      }

      return {
        ...state,
        partieNews: allArticles
      }

    case SET_AVAILABLE_NEWS_PARTIES:
      return {
        ...state,
        moreNews: action.valid
      }

    case LOADING_PARTIE_NEWS:
      return {
        ...state,
        partieLoading: action.valid
      }

    default:
      return state;
  }
}
