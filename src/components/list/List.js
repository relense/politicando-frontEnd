import { connect } from 'react-redux';
import { loadParties, asyncChangeCurrentPartie } from '../../actions/partiesActions';
import { asyncChangeView } from '../../actions/viewActions';
import React from 'react';
import './List.css';


class List extends React.Component {

  componentWillMount() {
    this.props.fetchParties()
  }

  selectPartie = (i) => {
    this.props.changeView("Partie");
    this.props.changeCurrentPartie(this.props.parties[i]);
  }

  renderData = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {

        let title = this.props.parties[i].description + ": " + this.props.parties[i].deputies_republic_chamber + " - Assembleia da República";
        data.push(
            <div key={i} className="partieNameContainer" title={title} onClick={() => this.selectPartie(i)}>
                { this.props.parties[i].party_name } - {this.props.parties[i].deputies_republic_chamber}
            </div>
        );
      }
    }

    return data;
  }

  render() {
    return (
      <div className="mainContainter">
        { this.renderData() }
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    fetchParties: () => {
      dispatch(loadParties())
    },
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(List);
