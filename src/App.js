import React, { Component } from 'react';
import { connect } from 'react-redux';
import Header from './components/header/Header.js';
import MainContent from './components/mainContent/MainContent.js';
import { loadParties } from './actions/partiesActions';
import { loadArticles } from './actions/articlesActions';

class App extends Component {
  componentWillMount() {
    this.props.fetchParties();
    this.props.fetchArticles();
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%'}}>
        <Header />
        <MainContent />
      </div>
    );
  }
}

function mapStateToProps(state) {
  return { }
}

function mapDispatchToProps(dispatch) {
  return {
    fetchParties: () => {
      dispatch(loadParties())
    },
    fetchArticles: () => {
        dispatch(loadArticles())
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
