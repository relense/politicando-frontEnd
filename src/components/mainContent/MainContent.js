import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import LatestNews from '../latestNews/LatestNews';
import { asyncCloseDrawer } from '../../redux/actions/viewActions';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

class MainContent extends Component {
  render() {
    return (
      <div className={(this.props.drawer ? 'mainContainerDark' : '') + checkDarkModeBackground(this.props.darkMode)} onClick={() => this.props.closeDrawer()}>
        <div className={this.props.drawer ? 'removeLinks' : ''}>
          <LatestNews articles={this.props.articles} />
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    articles: state.articles.allArticles,
    drawer: state.view.drawer,
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return { 
    closeDrawer: () => {
      dispatch(asyncCloseDrawer());
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MainContent);
